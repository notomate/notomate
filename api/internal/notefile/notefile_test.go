package notefile

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratesqlite3 "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/db/sqlitedb"
	"github.com/notomate/notomate/internal/model"
)

func setupDB(t *testing.T) db.DB {
	t.Helper()

	config.Init()
	// Not t.TempDir(): the gorm sqlite pool stays open past the test, which
	// makes TempDir cleanup fail on Windows.
	dir, err := os.MkdirTemp("", "notefile-test")
	if err != nil {
		t.Fatalf("mkdtemp: %v", err)
	}
	dsn := filepath.Join(dir, "test.db")
	config.C.Set(config.DB_DSN, dsn)

	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	driver, err := migratesqlite3.WithInstance(sqlDB, &migratesqlite3.Config{})
	if err != nil {
		t.Fatalf("migrate driver: %v", err)
	}
	m, err := migrate.NewWithDatabaseInstance("file://../../migrations/sqlite3", "main", driver)
	if err != nil {
		t.Fatalf("migrate instance: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("apply migrations: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close migration connection: %v", err)
	}

	database, err := sqlitedb.NewSqliteDB()
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	return database
}

func TestExtract(t *testing.T) {
	content := `{"type":"doc","content":[` +
		`{"type":"image","attrs":{"src":"/api/v1/workspaces/ws1/files/a.png"}},` +
		`{"type":"image","attrs":{"src":"/api/v1/workspaces/ws1/files/a.png"}},` +
		`{"type":"carouselNode","attrs":{"items":[{"src":"/api/v1/workspaces/ws1/files/b.mp4?w=640"}]}},` +
		`{"type":"image","attrs":{"src":"/api/v1/workspaces/other/files/c.png"}}]}`
	got := Extract("ws1", content)
	if want := []string{"a.png", "b.mp4"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("Extract = %v, want %v", got, want)
	}

	markdown := "look ![](/api/v1/workspaces/ws1/files/d.jpg) and [doc](/api/v1/workspaces/ws1/files/e.pdf)"
	if got, want := Extract("ws1", markdown), []string{"d.jpg", "e.pdf"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("Extract markdown = %v, want %v", got, want)
	}
}

func TestBackfillAndPublicAccess(t *testing.T) {
	database := setupDB(t)
	now := time.Now().UTC().Format(time.RFC3339)
	src := func(name string) string {
		return `{"type":"image","attrs":{"src":"/api/v1/workspaces/ws1/files/` + name + `"}}`
	}

	if err := database.CreateWorkspace(model.Workspace{ID: "ws1", Name: "ws", CreatedAt: now}); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	notes := []model.Note{
		{WorkspaceID: "ws1", ID: "n1", Visibility: "public", Content: src("pub.png"), CreatedAt: now},
		{WorkspaceID: "ws1", ID: "n2", Visibility: "private", Content: src("priv.png"), CreatedAt: now},
	}
	for _, n := range notes {
		if err := database.CreateNote(n); err != nil {
			t.Fatalf("create note: %v", err)
		}
	}
	comment := model.Comment{ID: "c1", WorkspaceID: "ws1", NoteID: "n1", ThreadID: "c1", Body: "![](/api/v1/workspaces/ws1/files/comment.png)", CreatedAt: now}
	if err := database.CreateComment(comment); err != nil {
		t.Fatalf("create comment: %v", err)
	}

	if err := Backfill(context.Background(), database); err != nil {
		t.Fatalf("backfill: %v", err)
	}
	if !Complete() {
		t.Fatal("backfill should be complete")
	}

	isPublic := func(name string) bool {
		t.Helper()
		ok, err := database.IsFileInPublicNote("ws1", name)
		if err != nil {
			t.Fatalf("IsFileInPublicNote(%s): %v", name, err)
		}
		return ok
	}
	if !isPublic("pub.png") || !isPublic("comment.png") {
		t.Fatal("files in a public note and its comments should be public")
	}
	if isPublic("priv.png") || isPublic("unused.png") {
		t.Fatal("files in private notes or no note should not be public")
	}

	used, err := database.FindNotesUsingFile("ws1", "comment.png")
	if err != nil || len(used) != 1 || used[0].ID != "n1" {
		t.Fatalf("FindNotesUsingFile = %v, %v; want [n1]", used, err)
	}

	// Removing the image from the note and deleting the comment hides both.
	notes[0].Content = `{"type":"doc"}`
	SyncNote(database, notes[0])
	if err := database.DeleteComment(comment); err != nil {
		t.Fatalf("delete comment: %v", err)
	}
	if isPublic("pub.png") || isPublic("comment.png") {
		t.Fatal("files no longer in the public note should not be public")
	}

	// A second run is a no-op.
	if err := Backfill(context.Background(), database); err != nil {
		t.Fatalf("second backfill: %v", err)
	}
}
