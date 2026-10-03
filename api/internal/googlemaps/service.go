package googlemaps

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"regexp"
	"time"

	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage"
	"github.com/notomate/notomate/internal/util"
)

const (
	KindSearch  = "search"
	KindDetails = "details"
	KindPhoto   = "photo"
	KindRoutes  = "routes"

	// Google allows caching most Places content for at most 30 days.
	SearchTTL  = 24 * time.Hour
	DetailsTTL = 7 * 24 * time.Hour
	PhotoTTL   = 30 * 24 * time.Hour
	RoutesTTL  = 24 * time.Hour

	photoStorageRoot = "_gmaps_cache"
)

var (
	ErrNotConfigured = errors.New("google_maps_not_configured")
	ErrInvalidPhoto  = errors.New("invalid photo name")
	ErrPhotoNotFound = errors.New("photo not found")

	photoNamePattern = regexp.MustCompile(`^places/([A-Za-z0-9_-]+)/photos/[A-Za-z0-9_-]+$`)
	placeIDPattern   = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

	// Photo widths are snapped to a few buckets so requests share cache entries.
	photoWidths = []int{200, 400, 800, 1600}
)

// Config is the decrypted per-workspace Google Maps configuration.
type Config struct {
	ServerKey  string `json:"serverKey"`
	BrowserKey string `json:"browserKey,omitempty"`
	MapID      string `json:"mapId,omitempty"`
}

// BrowserKeyOrFallback is the key handed to the browser for the Maps
// JavaScript API.
func (c Config) BrowserKeyOrFallback() string {
	if c.BrowserKey != "" {
		return c.BrowserKey
	}
	return c.ServerKey
}

type Service struct {
	db            db.DB
	storage       storage.Storage
	client        *Client
	encryptionKey func() string
	now           func() time.Time
	group         singleflight.Group
}

func NewService(d db.DB, s storage.Storage, client *Client, encryptionKey func() string) *Service {
	return &Service{
		db:            d,
		storage:       s,
		client:        client,
		encryptionKey: encryptionKey,
		now:           time.Now,
	}
}

// GetConfig returns ErrNotConfigured when the workspace has no key.
func (s *Service) GetConfig(workspaceID string) (Config, error) {
	i, err := s.db.FindWorkspaceIntegration(workspaceID, model.WorkspaceIntegrationProviderGoogleMaps)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Config{}, ErrNotConfigured
	}
	if err != nil {
		return Config{}, err
	}
	plain, err := util.Decrypt(i.ConfigEncrypted, s.encryptionKey())
	if err != nil {
		return Config{}, fmt.Errorf("decrypt google maps config: %w", err)
	}
	var cfg Config
	if err := json.Unmarshal([]byte(plain), &cfg); err != nil {
		return Config{}, err
	}
	if cfg.ServerKey == "" {
		return Config{}, ErrNotConfigured
	}
	return cfg, nil
}

func (s *Service) SaveConfig(workspaceID, userID string, cfg Config) error {
	plain, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	encrypted, err := util.Encrypt(string(plain), s.encryptionKey())
	if err != nil {
		return err
	}
	now := s.timestamp(s.now())
	return s.db.UpsertWorkspaceIntegration(model.WorkspaceIntegration{
		ID:              util.NewId(),
		WorkspaceID:     workspaceID,
		Provider:        model.WorkspaceIntegrationProviderGoogleMaps,
		ConfigEncrypted: encrypted,
		CreatedAt:       now,
		CreatedBy:       userID,
		UpdatedAt:       now,
		UpdatedBy:       userID,
	})
}

// DeleteConfig removes the key and everything cached with it.
func (s *Service) DeleteConfig(workspaceID string) error {
	if err := s.db.DeleteWorkspaceIntegration(workspaceID, model.WorkspaceIntegrationProviderGoogleMaps); err != nil {
		return err
	}
	return s.purge(model.GoogleMapsCacheFilter{WorkspaceID: workspaceID})
}

func (s *Service) SearchText(ctx context.Context, workspaceID string, req SearchRequest) (json.RawMessage, error) {
	if req.Bias != nil {
		// Round the bias so nearby map positions share a cache entry
		// (~1 km at 2 decimals).
		req.Bias = &LatLng{Lat: round(req.Bias.Lat, 2), Lng: round(req.Bias.Lng, 2)}
	}
	return s.cachedJSON(ctx, workspaceID, KindSearch, "", req, SearchTTL, func(key string) ([]byte, error) {
		return s.client.SearchText(ctx, key, req)
	})
}

func (s *Service) PlaceDetails(ctx context.Context, workspaceID, placeID, languageCode string) (json.RawMessage, error) {
	if !placeIDPattern.MatchString(placeID) {
		return nil, &APIError{StatusCode: 400, Message: "invalid place id"}
	}
	req := struct {
		PlaceID      string `json:"placeId"`
		LanguageCode string `json:"languageCode"`
	}{placeID, languageCode}
	return s.cachedJSON(ctx, workspaceID, KindDetails, placeID, req, DetailsTTL, func(key string) ([]byte, error) {
		return s.client.PlaceDetails(ctx, key, placeID, languageCode)
	})
}

func (s *Service) ComputeRoutes(ctx context.Context, workspaceID string, req RouteRequest) (json.RawMessage, error) {
	if err := req.Validate(); err != nil {
		return nil, &APIError{StatusCode: 400, Message: err.Error()}
	}
	// Keying on the field mask and alternatives keeps responses cached under
	// an older request shape (e.g. without transit details) from being served.
	keyReq := struct {
		RouteRequest
		FieldMask    string `json:"fieldMask"`
		Alternatives bool   `json:"alternatives"`
	}{req, routesFieldMask, req.TravelMode == "TRANSIT"}
	return s.cachedJSON(ctx, workspaceID, KindRoutes, "", keyReq, RoutesTTL, func(key string) ([]byte, error) {
		return s.client.ComputeRoutes(ctx, key, req)
	})
}

// PhotoParams validates a photo name and snaps the width to a cache bucket.
// It returns the place ID the photo belongs to.
func PhotoParams(name string, width int) (placeID string, snapped int, err error) {
	m := photoNamePattern.FindStringSubmatch(name)
	if m == nil {
		return "", 0, ErrInvalidPhoto
	}
	snapped = photoWidths[len(photoWidths)-1]
	for _, w := range photoWidths {
		if width <= w {
			snapped = w
			break
		}
	}
	return m[1], snapped, nil
}

// Photo returns a cached photo, fetching it from Google when allowFetch is
// true. Callers decide whether an uncached fetch is permitted (e.g. anonymous
// viewers of shared notes may only trigger fetches for places this
// workspace has already looked up).
func (s *Service) Photo(ctx context.Context, workspaceID, name string, width int, allowFetch func(placeID string) (bool, error)) (io.ReadSeekCloser, string, error) {
	placeID, width, err := PhotoParams(name, width)
	if err != nil {
		return nil, "", err
	}
	req := struct {
		Name  string `json:"name"`
		Width int    `json:"width"`
	}{name, width}
	cacheKey, err := s.cacheKey(workspaceID, KindPhoto, req)
	if err != nil {
		return nil, "", err
	}

	if entry, err := s.db.FindGoogleMapsCache(cacheKey, s.timestamp(s.now())); err == nil {
		if f, err := s.storage.Load(photoSegments(workspaceID, entry.Response)); err == nil {
			return f, entry.ContentType, nil
		}
	}

	ok, err := allowFetch(placeID)
	if err != nil {
		return nil, "", err
	}
	if !ok {
		return nil, "", ErrPhotoNotFound
	}

	v, err, _ := s.group.Do(cacheKey, func() (any, error) {
		cfg, err := s.GetConfig(workspaceID)
		if err != nil {
			return nil, err
		}
		data, contentType, err := s.client.PhotoMedia(ctx, cfg.ServerKey, name, width)
		if err != nil {
			return nil, err
		}
		fileName := cacheKey
		if err := s.storage.Save(photoSegments(workspaceID, fileName), bytes.NewReader(data)); err != nil {
			return nil, err
		}
		now := s.now()
		if err := s.db.UpsertGoogleMapsCache(model.GoogleMapsCache{
			CacheKey:    cacheKey,
			WorkspaceID: workspaceID,
			Kind:        KindPhoto,
			Ref:         placeID,
			Response:    fileName,
			ContentType: contentType,
			CreatedAt:   s.timestamp(now),
			ExpiresAt:   s.timestamp(now.Add(PhotoTTL)),
		}); err != nil {
			log.Printf("googlemaps: cache photo: %v", err)
		}
		return photoResult{data, contentType}, nil
	})
	if err != nil {
		return nil, "", err
	}
	p := v.(photoResult)
	return nopCloser{bytes.NewReader(p.data)}, p.contentType, nil
}

type photoResult struct {
	data        []byte
	contentType string
}

type nopCloser struct{ *bytes.Reader }

func (nopCloser) Close() error { return nil }

// HasPlace reports whether the workspace has looked up this place's details.
func (s *Service) HasPlace(workspaceID, placeID string) (bool, error) {
	return s.db.HasGoogleMapsCacheRef(workspaceID, KindDetails, placeID)
}

// StartJanitor removes expired cache entries (and cached photo files)
// periodically until ctx is cancelled.
func (s *Service) StartJanitor(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			if err := s.PurgeExpired(); err != nil {
				log.Printf("googlemaps: purge expired cache: %v", err)
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func (s *Service) PurgeExpired() error {
	return s.purge(model.GoogleMapsCacheFilter{ExpiresBefore: s.timestamp(s.now())})
}

func (s *Service) purge(f model.GoogleMapsCacheFilter) error {
	photoFilter := f
	photoFilter.Kind = KindPhoto
	photos, err := s.db.FindGoogleMapsCacheEntries(photoFilter)
	if err != nil {
		return err
	}
	for _, p := range photos {
		if err := s.storage.Delete(photoSegments(p.WorkspaceID, p.Response)); err != nil {
			log.Printf("googlemaps: delete cached photo %s: %v", p.Response, err)
		}
	}
	return s.db.DeleteGoogleMapsCacheEntries(f)
}

func (s *Service) cachedJSON(ctx context.Context, workspaceID, kind, ref string, req any, ttl time.Duration, fetch func(apiKey string) ([]byte, error)) (json.RawMessage, error) {
	cacheKey, err := s.cacheKey(workspaceID, kind, req)
	if err != nil {
		return nil, err
	}
	if entry, err := s.db.FindGoogleMapsCache(cacheKey, s.timestamp(s.now())); err == nil {
		return json.RawMessage(entry.Response), nil
	}

	v, err, _ := s.group.Do(cacheKey, func() (any, error) {
		cfg, err := s.GetConfig(workspaceID)
		if err != nil {
			return nil, err
		}
		data, err := fetch(cfg.ServerKey)
		if err != nil {
			return nil, err
		}
		now := s.now()
		if err := s.db.UpsertGoogleMapsCache(model.GoogleMapsCache{
			CacheKey:    cacheKey,
			WorkspaceID: workspaceID,
			Kind:        kind,
			Ref:         ref,
			Response:    string(data),
			ContentType: "application/json",
			CreatedAt:   s.timestamp(now),
			ExpiresAt:   s.timestamp(now.Add(ttl)),
		}); err != nil {
			log.Printf("googlemaps: cache %s: %v", kind, err)
		}
		return data, nil
	})
	if err != nil {
		return nil, err
	}
	return json.RawMessage(v.([]byte)), nil
}

func (s *Service) cacheKey(workspaceID, kind string, req any) (string, error) {
	payload, err := json.Marshal(req)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(workspaceID + "|" + kind + "|" + string(payload)))
	return hex.EncodeToString(sum[:]), nil
}

// timestamp uses a fixed-width UTC layout so string comparison in SQL orders
// correctly.
func (s *Service) timestamp(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05Z")
}

func photoSegments(workspaceID, fileName string) []string {
	return []string{photoStorageRoot, workspaceID, fileName}
}

func round(v float64, decimals int) float64 {
	p := math.Pow(10, float64(decimals))
	return math.Round(v*p) / p
}
