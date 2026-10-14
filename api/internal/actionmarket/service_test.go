package actionmarket

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	migratesqlite3 "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"
	"github.com/spf13/viper"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/db/sqlitedb"
	"github.com/notomate/notomate/internal/github"
	"github.com/notomate/notomate/internal/model"
)

const (
	testWorkspace = "ws1"
	testKey       = "0123456789abcdef0123456789abcdef"
)

func newTestDB(t *testing.T) db.DB {
	t.Helper()
	// Not t.TempDir: db.DB exposes no Close, and Windows refuses to delete
	// the still-open SQLite file during TempDir cleanup.
	dir, err := os.MkdirTemp("", "actionmarket-test-")
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
	for _, ws := range []string{testWorkspace, "ws2"} {
		if err := d.CreateWorkspace(model.Workspace{ID: ws, Name: ws}); err != nil {
			t.Fatal(err)
		}
	}
	return d
}

// fakeRepo serves one repository o/r whose tree holds the given files. When
// token is set, requests without it get 404 like GitHub does for private
// repositories.
func fakeRepo(t *testing.T, token string, files map[string]string) *github.Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token != "" && r.Header.Get("Authorization") != "Bearer "+token {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		switch {
		case r.URL.Path == "/repos/o/r":
			_ = json.NewEncoder(w).Encode(map[string]any{"default_branch": "main"})
		case r.URL.Path == "/repos/o/r/commits/main":
			_ = json.NewEncoder(w).Encode(map[string]any{"sha": "sha1"})
		case r.URL.Path == "/repos/o/r/git/trees/sha1":
			var entries []map[string]string
			for p := range files {
				entries = append(entries, map[string]string{"path": p, "type": "blob", "sha": p})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"tree": entries})
		case strings.HasPrefix(r.URL.Path, "/repos/o/r/git/blobs/"):
			p := strings.TrimPrefix(r.URL.Path, "/repos/o/r/git/blobs/")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"content":  base64.StdEncoding.EncodeToString([]byte(files[p])),
				"encoding": "base64",
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	c := github.NewClient()
	c.BaseURL = srv.URL
	return c
}

func newSource(t *testing.T, d db.DB, workspaceID string) model.ActionSource {
	t.Helper()
	src := model.ActionSource{ID: "src-" + workspaceID, WorkspaceID: workspaceID, Owner: "o", Repo: "r", Status: model.ActionSourceStatusPending}
	if err := d.CreateActionSource(src); err != nil {
		t.Fatal(err)
	}
	return src
}

const composite = "name: %s\ninputs:\n  who:\n    required: true\n    default: world\nruns:\n  using: composite\n  steps: []\n"

func TestSyncStoresActionsAndReplacesThemOnResync(t *testing.T) {
	d := newTestDB(t)
	files := map[string]string{
		"action.yml":         strings.Replace(composite, "%s", "Root", 1),
		"tools/a/action.yml": strings.Replace(composite, "%s", "A", 1),
	}
	svc := NewService(d, fakeRepo(t, "", files), func() string { return testKey })
	src := newSource(t, d, testWorkspace)

	synced, err := svc.Sync(context.Background(), src, "u1")
	if err != nil {
		t.Fatal(err)
	}
	if synced.Status != model.ActionSourceStatusOK || synced.ResolvedRef != "main" || synced.ResolvedSHA != "sha1" || synced.LastError != "" {
		t.Fatalf("synced = %+v", synced)
	}
	stored, err := d.FindActionSource(testWorkspace, src.ID)
	if err != nil || stored.Status != model.ActionSourceStatusOK || stored.LastSyncedAt == "" {
		t.Fatalf("stored = %+v, %v", stored, err)
	}

	actions, err := d.FindMarketplaceActions(testWorkspace)
	if err != nil {
		t.Fatal(err)
	}
	if len(actions) != 2 || actions[0].Uses != "o/r@main" || actions[1].Uses != "o/r/tools/a@main" {
		t.Fatalf("actions = %+v", actions)
	}
	if len(actions[1].Inputs) != 1 || actions[1].Inputs[0].Name != "who" || !actions[1].Inputs[0].Required || actions[1].Inputs[0].Default != "world" {
		t.Fatalf("inputs = %+v", actions[1].Inputs)
	}

	delete(files, "tools/a/action.yml")
	if _, err := svc.Sync(context.Background(), src, "u1"); err != nil {
		t.Fatal(err)
	}
	actions, _ = d.FindMarketplaceActions(testWorkspace)
	if len(actions) != 1 || actions[0].Uses != "o/r@main" {
		t.Fatalf("after resync actions = %+v", actions)
	}
}

func TestSyncPrivateRepoNeedsToken(t *testing.T) {
	d := newTestDB(t)
	files := map[string]string{"action.yml": strings.Replace(composite, "%s", "Private", 1)}
	svc := NewService(d, fakeRepo(t, "pat", files), func() string { return testKey })
	src := newSource(t, d, testWorkspace)

	synced, err := svc.Sync(context.Background(), src, "u1")
	if err != nil {
		t.Fatal(err)
	}
	if synced.Status != model.ActionSourceStatusError || !strings.Contains(synced.LastError, "GitHub token") {
		t.Fatalf("without token: %+v", synced)
	}

	if err := svc.SaveToken(testWorkspace, "u1", "pat"); err != nil {
		t.Fatal(err)
	}
	if has, err := svc.HasToken(testWorkspace); err != nil || !has {
		t.Fatalf("HasToken = %v, %v", has, err)
	}
	if has, _ := svc.HasToken("ws2"); has {
		t.Fatal("token must not leak to another workspace")
	}
	if tok, _ := LoadToken(d, testKey, testWorkspace); tok != "pat" {
		t.Fatalf("LoadToken = %q", tok)
	}

	synced, err = svc.Sync(context.Background(), src, "u1")
	if err != nil {
		t.Fatal(err)
	}
	if synced.Status != model.ActionSourceStatusOK {
		t.Fatalf("with token: %+v", synced)
	}

	if err := svc.DeleteToken(testWorkspace); err != nil {
		t.Fatal(err)
	}
	if tok, err := LoadToken(d, testKey, testWorkspace); err != nil || tok != "" {
		t.Fatalf("after delete LoadToken = %q, %v", tok, err)
	}
}

func TestActionSourcesAreScopedToWorkspace(t *testing.T) {
	d := newTestDB(t)
	svc := NewService(d, fakeRepo(t, "", map[string]string{"action.yml": strings.Replace(composite, "%s", "X", 1)}), func() string { return testKey })
	src := newSource(t, d, testWorkspace)
	if _, err := svc.Sync(context.Background(), src, "u1"); err != nil {
		t.Fatal(err)
	}

	if _, err := d.FindActionSource("ws2", src.ID); err == nil {
		t.Fatal("source must not be visible from another workspace")
	}
	if actions, _ := d.FindMarketplaceActions("ws2"); len(actions) != 0 {
		t.Fatalf("ws2 actions = %+v", actions)
	}

	// Deleting through another workspace is a no-op.
	if err := d.DeleteActionSource("ws2", src.ID); err != nil {
		t.Fatal(err)
	}
	if actions, _ := d.FindMarketplaceActions(testWorkspace); len(actions) != 1 {
		t.Fatalf("actions after foreign delete = %+v", actions)
	}

	if err := d.DeleteActionSource(testWorkspace, src.ID); err != nil {
		t.Fatal(err)
	}
	if actions, _ := d.FindMarketplaceActions(testWorkspace); len(actions) != 0 {
		t.Fatalf("actions after delete = %+v", actions)
	}
}
