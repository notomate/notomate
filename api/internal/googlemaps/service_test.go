package googlemaps

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratesqlite3 "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"
	"github.com/spf13/viper"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/db/sqlitedb"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage/localfile"
)

const testWorkspace = "ws1"

type testEnv struct {
	svc      *Service
	db       db.DB
	hits     map[string]*int64
	storeDir string
	now      time.Time
}

func newTestEnv(t *testing.T, delay time.Duration) *testEnv {
	t.Helper()
	// Not t.TempDir: db.DB exposes no Close, and Windows refuses to delete
	// the still-open SQLite file during TempDir cleanup.
	dir, err := os.MkdirTemp("", "googlemaps-test-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	dsn := filepath.Join(dir, "test.db")

	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		t.Fatal(err)
	}
	driver, err := migratesqlite3.WithInstance(sqlDB, &migratesqlite3.Config{})
	if err != nil {
		t.Fatal(err)
	}
	m, err := migrate.NewWithDatabaseInstance("file://../../migrations/sqlite3", "main", driver)
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatal(err)
	}
	sqlDB.Close()

	prev := config.C
	config.C = viper.New()
	config.C.Set(config.DB_DSN, dsn)
	t.Cleanup(func() { config.C = prev })
	d, err := sqlitedb.NewSqliteDB()
	if err != nil {
		t.Fatal(err)
	}
	if err := d.CreateWorkspace(model.Workspace{ID: testWorkspace, Name: "w"}); err != nil {
		t.Fatal(err)
	}

	env := &testEnv{db: d, hits: map[string]*int64{}, now: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	for _, k := range []string{"search", "details", "routes", "media", "img"} {
		var n int64
		env.hits[k] = &n
	}

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(delay)
		switch {
		case r.URL.Path == "/v1/places:searchText":
			atomic.AddInt64(env.hits["search"], 1)
			w.Write([]byte(`{"places":[{"id":"P1"}]}`))
		case strings.HasSuffix(r.URL.Path, "/media"):
			atomic.AddInt64(env.hits["media"], 1)
			w.Write([]byte(`{"photoUri":"` + srv.URL + `/img"}`))
		case r.URL.Path == "/img":
			atomic.AddInt64(env.hits["img"], 1)
			w.Header().Set("Content-Type", "image/jpeg")
			w.Write([]byte("jpeg"))
		case strings.HasPrefix(r.URL.Path, "/v1/places/"):
			atomic.AddInt64(env.hits["details"], 1)
			w.Write([]byte(`{"id":"P1","photos":[{"name":"places/P1/photos/X"}]}`))
		case r.URL.Path == "/directions/v2:computeRoutes":
			atomic.AddInt64(env.hits["routes"], 1)
			w.Write([]byte(`{"routes":[{"distanceMeters":10}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	env.storeDir = filepath.Join(dir, "uploads") + "/"
	client := &Client{PlacesBaseURL: srv.URL + "/v1", RoutesBaseURL: srv.URL, HTTP: srv.Client()}
	env.svc = NewService(d, localfile.NewLocalFileStorage(env.storeDir), client, func() string { return "test-secret" })
	env.svc.now = func() time.Time { return env.now }
	return env
}

func (e *testEnv) configure(t *testing.T) {
	t.Helper()
	if err := e.svc.SaveConfig(testWorkspace, "u1", Config{ServerKey: "server", MapID: "m"}); err != nil {
		t.Fatal(err)
	}
}

func (e *testEnv) count(k string) int64 { return atomic.LoadInt64(e.hits[k]) }

func TestNotConfigured(t *testing.T) {
	env := newTestEnv(t, 0)
	_, err := env.svc.SearchText(context.Background(), testWorkspace, SearchRequest{Query: "x"})
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err = %v", err)
	}
}

func TestConfigRoundTripIsEncrypted(t *testing.T) {
	env := newTestEnv(t, 0)
	env.configure(t)

	cfg, err := env.svc.GetConfig(testWorkspace)
	if err != nil || cfg.ServerKey != "server" || cfg.BrowserKeyOrFallback() != "server" || cfg.MapID != "m" {
		t.Fatalf("cfg = %+v, err = %v", cfg, err)
	}
	row, err := env.db.FindWorkspaceIntegration(testWorkspace, model.WorkspaceIntegrationProviderGoogleMaps)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(row.ConfigEncrypted, "server") {
		t.Fatal("config stored in plaintext")
	}
}

func TestSearchIsCachedUntilExpiry(t *testing.T) {
	env := newTestEnv(t, 0)
	env.configure(t)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		// Nearby bias points round to the same cache entry.
		bias := &LatLng{Lat: 25.0331 + float64(i)*0.0001, Lng: 121.5654}
		if _, err := env.svc.SearchText(ctx, testWorkspace, SearchRequest{Query: "cafe", Bias: bias}); err != nil {
			t.Fatal(err)
		}
	}
	if got := env.count("search"); got != 1 {
		t.Fatalf("search hits = %d, want 1", got)
	}

	env.now = env.now.Add(SearchTTL + time.Minute)
	if _, err := env.svc.SearchText(ctx, testWorkspace, SearchRequest{Query: "cafe"}); err != nil {
		t.Fatal(err)
	}
	if _, err := env.svc.SearchText(ctx, testWorkspace, SearchRequest{Query: "cafe", Bias: &LatLng{Lat: 25.0331, Lng: 121.5654}}); err != nil {
		t.Fatal(err)
	}
	if got := env.count("search"); got != 3 {
		t.Fatalf("search hits after expiry = %d, want 3", got)
	}
}

func TestConcurrentRequestsShareOneFetch(t *testing.T) {
	env := newTestEnv(t, 100*time.Millisecond)
	env.configure(t)

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := RouteRequest{Waypoints: []Waypoint{{PlaceID: "A"}, {PlaceID: "B"}}, TravelMode: "DRIVE"}
			if _, err := env.svc.ComputeRoutes(context.Background(), testWorkspace, req); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if got := env.count("routes"); got != 1 {
		t.Fatalf("routes hits = %d, want 1", got)
	}
}

func TestPhotoAccessAndCaching(t *testing.T) {
	env := newTestEnv(t, 0)
	env.configure(t)
	ctx := context.Background()
	deny := func(string) (bool, error) { return false, nil }
	allowKnown := func(placeID string) (bool, error) { return env.svc.HasPlace(testWorkspace, placeID) }

	if _, _, err := env.svc.Photo(ctx, testWorkspace, "../etc/passwd", 400, deny); !errors.Is(err, ErrInvalidPhoto) {
		t.Fatalf("invalid name err = %v", err)
	}
	if _, _, err := env.svc.Photo(ctx, testWorkspace, "places/P1/photos/X", 400, allowKnown); !errors.Is(err, ErrPhotoNotFound) {
		t.Fatalf("unknown place err = %v", err)
	}

	if _, err := env.svc.PlaceDetails(ctx, testWorkspace, "P1", "en"); err != nil {
		t.Fatal(err)
	}
	f, ct, err := env.svc.Photo(ctx, testWorkspace, "places/P1/photos/X", 350, allowKnown)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(f)
	f.Close()
	if string(data) != "jpeg" || ct != "image/jpeg" {
		t.Fatalf("photo = %q %q", data, ct)
	}

	// Served from cache even when fetching is not allowed; 350 and 400 share
	// the 400px bucket.
	f, _, err = env.svc.Photo(ctx, testWorkspace, "places/P1/photos/X", 400, deny)
	if err != nil {
		t.Fatal(err)
	}
	f.Close()
	if got := env.count("img"); got != 1 {
		t.Fatalf("img hits = %d, want 1", got)
	}
}

func TestDeleteConfigPurgesCache(t *testing.T) {
	env := newTestEnv(t, 0)
	env.configure(t)
	ctx := context.Background()
	allow := func(string) (bool, error) { return true, nil }

	if _, err := env.svc.PlaceDetails(ctx, testWorkspace, "P1", ""); err != nil {
		t.Fatal(err)
	}
	f, _, err := env.svc.Photo(ctx, testWorkspace, "places/P1/photos/X", 800, allow)
	if err != nil {
		t.Fatal(err)
	}
	f.Close()

	if err := env.svc.DeleteConfig(testWorkspace); err != nil {
		t.Fatal(err)
	}
	entries, err := env.db.FindGoogleMapsCacheEntries(model.GoogleMapsCacheFilter{WorkspaceID: testWorkspace})
	if err != nil || len(entries) != 0 {
		t.Fatalf("entries = %d, err = %v", len(entries), err)
	}
	files, _ := os.ReadDir(filepath.Join(env.storeDir, photoStorageRoot, testWorkspace))
	if len(files) != 0 {
		t.Fatalf("cached photo files left: %d", len(files))
	}
	if _, err := env.svc.GetConfig(testWorkspace); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("config err = %v", err)
	}
}

func TestPurgeExpiredKeepsFreshEntries(t *testing.T) {
	env := newTestEnv(t, 0)
	env.configure(t)
	ctx := context.Background()

	if _, err := env.svc.SearchText(ctx, testWorkspace, SearchRequest{Query: "a"}); err != nil {
		t.Fatal(err)
	}
	if _, err := env.svc.PlaceDetails(ctx, testWorkspace, "P1", ""); err != nil {
		t.Fatal(err)
	}

	env.now = env.now.Add(SearchTTL + time.Hour)
	if err := env.svc.PurgeExpired(); err != nil {
		t.Fatal(err)
	}
	entries, _ := env.db.FindGoogleMapsCacheEntries(model.GoogleMapsCacheFilter{WorkspaceID: testWorkspace})
	if len(entries) != 1 || entries[0].Kind != KindDetails {
		t.Fatalf("entries after purge = %+v", entries)
	}
}
