// Package googlemaps proxies the Google Places API (New) and Routes API for a
// workspace, caching responses so repeated lookups don't hit Google again.
package googlemaps

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

const (
	DefaultPlacesBaseURL = "https://places.googleapis.com/v1"
	DefaultRoutesBaseURL = "https://routes.googleapis.com"

	// MaxIntermediates is the Routes API limit for intermediate waypoints
	// (non-transit travel modes).
	MaxIntermediates = 25

	maxPhotoBytes = 10 << 20
)

const searchFieldMask = "places.id,places.displayName,places.formattedAddress,places.location," +
	"places.rating,places.userRatingCount,places.types,places.primaryTypeDisplayName,places.googleMapsUri"

const detailsFieldMask = "id,displayName,formattedAddress,location,rating,userRatingCount,types," +
	"primaryTypeDisplayName,websiteUri,nationalPhoneNumber,internationalPhoneNumber,regularOpeningHours," +
	"priceLevel,googleMapsUri,photos,editorialSummary,businessStatus,viewport"

const routesFieldMask = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline," +
	"routes.viewport,routes.localizedValues,routes.warnings,routes.optimizedIntermediateWaypointIndex," +
	"routes.legs.distanceMeters,routes.legs.duration,routes.legs.localizedValues," +
	"routes.legs.startLocation,routes.legs.endLocation," +
	"routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration," +
	"routes.legs.steps.navigationInstruction,routes.legs.steps.localizedValues,routes.legs.steps.travelMode," +
	"routes.legs.steps.transitDetails"

// APIError is a non-2xx response from Google.
type APIError struct {
	StatusCode int
	Status     string
	Message    string
}

func (e *APIError) Error() string {
	if e.Message == "" {
		return fmt.Sprintf("google maps api: http %d", e.StatusCode)
	}
	return fmt.Sprintf("google maps api: %s", e.Message)
}

type Client struct {
	PlacesBaseURL string
	RoutesBaseURL string
	HTTP          *http.Client
}

func NewClient() *Client {
	return &Client{
		PlacesBaseURL: DefaultPlacesBaseURL,
		RoutesBaseURL: DefaultRoutesBaseURL,
		HTTP:          &http.Client{Timeout: 20 * time.Second},
	}
}

type LatLng struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type SearchRequest struct {
	Query        string  `json:"query"`
	LanguageCode string  `json:"languageCode,omitempty"`
	Bias         *LatLng `json:"bias,omitempty"`
	// BiasRadius is in meters; only used with Bias.
	BiasRadius float64 `json:"biasRadius,omitempty"`
}

type Waypoint struct {
	PlaceID string  `json:"placeId,omitempty"`
	Lat     float64 `json:"lat,omitempty"`
	Lng     float64 `json:"lng,omitempty"`
}

type RouteRequest struct {
	Waypoints    []Waypoint `json:"waypoints"`
	TravelMode   string     `json:"travelMode"`
	Optimize     bool       `json:"optimize"`
	LanguageCode string     `json:"languageCode,omitempty"`
}

var travelModes = map[string]bool{
	"DRIVE":       true,
	"WALK":        true,
	"BICYCLE":     true,
	"TWO_WHEELER": true,
	"TRANSIT":     true,
}

// Validate checks the request against Routes API constraints so callers get
// a clear message instead of a generic Google error.
func (r RouteRequest) Validate() error {
	if len(r.Waypoints) < 2 {
		return fmt.Errorf("at least 2 waypoints are required")
	}
	if !travelModes[r.TravelMode] {
		return fmt.Errorf("unsupported travel mode %q", r.TravelMode)
	}
	intermediates := len(r.Waypoints) - 2
	if r.TravelMode == "TRANSIT" && intermediates > 0 {
		return fmt.Errorf("transit routes do not support intermediate waypoints")
	}
	if intermediates > MaxIntermediates {
		return fmt.Errorf("at most %d intermediate waypoints are supported", MaxIntermediates)
	}
	for i, w := range r.Waypoints {
		if w.PlaceID == "" && w.Lat == 0 && w.Lng == 0 {
			return fmt.Errorf("waypoint %d has no place or location", i+1)
		}
	}
	return nil
}

func (c *Client) SearchText(ctx context.Context, apiKey string, req SearchRequest) ([]byte, error) {
	body := map[string]any{
		"textQuery":      req.Query,
		"maxResultCount": 20,
	}
	if req.LanguageCode != "" {
		body["languageCode"] = req.LanguageCode
	}
	if req.Bias != nil {
		radius := req.BiasRadius
		if radius <= 0 {
			radius = 20000
		}
		body["locationBias"] = map[string]any{
			"circle": map[string]any{
				"center": map[string]float64{"latitude": req.Bias.Lat, "longitude": req.Bias.Lng},
				"radius": radius,
			},
		}
	}
	return c.postJSON(ctx, c.PlacesBaseURL+"/places:searchText", apiKey, searchFieldMask, body)
}

func (c *Client) PlaceDetails(ctx context.Context, apiKey, placeID, languageCode string) ([]byte, error) {
	u := c.PlacesBaseURL + "/places/" + url.PathEscape(placeID)
	if languageCode != "" {
		u += "?languageCode=" + url.QueryEscape(languageCode)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Goog-Api-Key", apiKey)
	req.Header.Set("X-Goog-FieldMask", detailsFieldMask)
	return c.do(req)
}

// PhotoMedia downloads a place photo. name has the form
// places/{placeId}/photos/{photoId}.
func (c *Client) PhotoMedia(ctx context.Context, apiKey, name string, maxWidth int) ([]byte, string, error) {
	// Ask for the photo URI instead of following the redirect, so the API key
	// header is never forwarded to the image host.
	u := c.PlacesBaseURL + "/" + name + "/media?skipHttpRedirect=true&maxWidthPx=" + strconv.Itoa(maxWidth)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("X-Goog-Api-Key", apiKey)
	meta, err := c.do(req)
	if err != nil {
		return nil, "", err
	}
	var media struct {
		PhotoURI string `json:"photoUri"`
	}
	if err := json.Unmarshal(meta, &media); err != nil || media.PhotoURI == "" {
		return nil, "", fmt.Errorf("google maps api: photo uri missing")
	}

	imgReq, err := http.NewRequestWithContext(ctx, http.MethodGet, media.PhotoURI, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := c.HTTP.Do(imgReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxPhotoBytes))
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", parseAPIError(resp.StatusCode, data)
	}
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}
	return data, contentType, nil
}

func (c *Client) ComputeRoutes(ctx context.Context, apiKey string, req RouteRequest) ([]byte, error) {
	toWaypoint := func(w Waypoint) map[string]any {
		if w.PlaceID != "" {
			return map[string]any{"placeId": w.PlaceID}
		}
		return map[string]any{
			"location": map[string]any{
				"latLng": map[string]float64{"latitude": w.Lat, "longitude": w.Lng},
			},
		}
	}

	n := len(req.Waypoints)
	body := map[string]any{
		"origin":      toWaypoint(req.Waypoints[0]),
		"destination": toWaypoint(req.Waypoints[n-1]),
		"travelMode":  req.TravelMode,
		"units":       "METRIC",
	}
	if n > 2 {
		intermediates := make([]map[string]any, 0, n-2)
		for _, w := range req.Waypoints[1 : n-1] {
			intermediates = append(intermediates, toWaypoint(w))
		}
		body["intermediates"] = intermediates
		if req.Optimize {
			body["optimizeWaypointOrder"] = true
		}
	}
	// Transit has several reasonable line combinations, so let the user pick;
	// other modes keep the single best route.
	if req.TravelMode == "TRANSIT" {
		body["computeAlternativeRoutes"] = true
	}
	if req.LanguageCode != "" {
		body["languageCode"] = req.LanguageCode
	}
	return c.postJSON(ctx, c.RoutesBaseURL+"/directions/v2:computeRoutes", apiKey, routesFieldMask, body)
}

func (c *Client) postJSON(ctx context.Context, u, apiKey, fieldMask string, body any) ([]byte, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Goog-Api-Key", apiKey)
	req.Header.Set("X-Goog-FieldMask", fieldMask)
	return c.do(req)
}

func (c *Client) do(req *http.Request) ([]byte, error) {
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxPhotoBytes))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, parseAPIError(resp.StatusCode, data)
	}
	return data, nil
}

func parseAPIError(statusCode int, data []byte) error {
	var body struct {
		Error struct {
			Message string `json:"message"`
			Status  string `json:"status"`
		} `json:"error"`
	}
	_ = json.Unmarshal(data, &body)
	return &APIError{StatusCode: statusCode, Status: body.Error.Status, Message: body.Error.Message}
}
