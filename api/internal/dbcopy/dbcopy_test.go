package dbcopy

import (
	"database/sql"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/notomate/notomate/internal/bootstrap"
)

// Migrations are read from file://migrations/<driver>, relative to the api
// module root.
func TestMain(m *testing.M) {
	if err := os.Chdir("../.."); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func newSqlite(t *testing.T, name string) Endpoint {
	t.Helper()
	return Endpoint{Driver: "sqlite3", DSN: filepath.Join(t.TempDir(), name)}
}

// newMySQL creates an empty database on the server named by
// NOTOMATE_TEST_MYSQL_DSN and skips the test when it is unset.
func newMySQL(t *testing.T) Endpoint {
	t.Helper()
	baseDSN := os.Getenv("NOTOMATE_TEST_MYSQL_DSN")
	if baseDSN == "" {
		t.Skip("NOTOMATE_TEST_MYSQL_DSN not set")
	}
	cfg, err := mysql.ParseDSN(baseDSN)
	if err != nil {
		t.Fatalf("parse dsn: %v", err)
	}
	admin, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	name := fmt.Sprintf("notomate_copy_%d", time.Now().UnixNano())
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	t.Cleanup(func() {
		if conn, err := sql.Open("mysql", cfg.FormatDSN()); err == nil {
			conn.Exec("DROP DATABASE " + name)
			conn.Close()
		}
	})
	cfg.DBName = name
	return Endpoint{Driver: "mysql", DSN: cfg.FormatDSN()}
}

// newPostgres creates an empty database on the server named by
// NOTOMATE_TEST_POSTGRES_DSN (a URL, e.g.
// "postgres://postgres:postgres@127.0.0.1:5432/?sslmode=disable") and skips
// the test when it is unset.
func newPostgres(t *testing.T) Endpoint {
	t.Helper()
	baseDSN := os.Getenv("NOTOMATE_TEST_POSTGRES_DSN")
	if baseDSN == "" {
		t.Skip("NOTOMATE_TEST_POSTGRES_DSN not set")
	}
	u, err := url.Parse(baseDSN)
	if err != nil {
		t.Fatalf("parse dsn: %v", err)
	}
	admin, err := sql.Open("postgres", baseDSN)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	name := fmt.Sprintf("notomate_copy_%d", time.Now().UnixNano())
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	t.Cleanup(func() {
		if conn, err := sql.Open("postgres", baseDSN); err == nil {
			conn.Exec("DROP DATABASE " + name + " WITH (FORCE)")
			conn.Close()
		}
	})
	u.Path = "/" + name
	return Endpoint{Driver: "postgres", DSN: u.String()}
}

// seed fills a migrated sqlite database with rows covering the conversions
// the copy has to make.
func seed(t *testing.T, e Endpoint) {
	t.Helper()
	if err := bootstrap.RunMigrationFor(e.Driver, e.DSN); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open(e.Driver, e.DSN)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	stmts := []struct {
		query string
		args  []any
	}{
		{"INSERT INTO users (id, email, name, password_hash, role, disabled) VALUES ('u1', 'a@example.com', 'alice', 'hash', 'admin', 0), ('u2', 'b@example.com', 'bob', 'hash', 'user', 1)", nil},
		{"INSERT INTO workspaces (id, name, created_by) VALUES ('ws', '工作區 😀', 'u1')", nil},
		{"INSERT INTO workspace_users (user_id, workspace_id, role) VALUES ('u1', 'ws', 'owner'), ('u1', 'gone', 'owner')", nil},
		// n1 is a root note stored with parent_id ''; n3's parent n9 is gone;
		// n4 belongs to a deleted workspace.
		{"INSERT INTO notes (workspace_id, id, title, content, visibility, parent_id, pinned, created_at) VALUES " +
			"('ws', 'n1', '根', ?, 'public', '', 1, '2026-01-01T00:00:00Z'), " +
			"('ws', 'n2', 'child', 'c', 'private', 'n1', 0, '2026-01-02T00:00:00Z'), " +
			"('ws', 'n3', 'lost', 'c', 'private', 'n9', 0, '2026-01-03T00:00:00Z'), " +
			"('gone', 'n4', 'orphan', 'c', 'private', '', 0, '2026-01-04T00:00:00Z')", []any{strings.Repeat("長內容", 30000)}},
		{"INSERT INTO comments (id, workspace_id, note_id, thread_id, quoted_text, body, edited) VALUES ('c1', 'ws', 'n1', 't', 'q', 'hi', 1), ('c2', 'ws', 'n4', 't', 'q', 'orphan', 0)", nil},
		{"INSERT INTO views (workspace_id, id, name, type, data, visibility, note_id) VALUES ('ws', 'v1', 'board', 'kanban', '{}', 'workspace', ''), ('ws', 'v2', 'note view', 'kanban', '{}', 'workspace', 'n1'), ('ws', 'v3', 'dead', 'kanban', '{}', 'workspace', 'n9')", nil},
		{"INSERT INTO view_objects (id, view_id, name, type, data) VALUES ('vo1', 'v1', 'o', 't', '{}'), ('vo2', 'v3', 'o', 't', '{}')", nil},
		{"INSERT INTO yjs_documents (name, data, updated_at) VALUES ('doc', ?, 'now')", []any{[]byte{0, 1, 2, 255, 0}}},
		{"INSERT INTO workflows (id, workspace_id, name, definition, enabled) VALUES ('wf', 'ws', 'wf', 'on: push', 1)", nil},
		{"INSERT INTO workflow_runs (id, workflow_id, workspace_id, run_number, event, event_payload, status) VALUES ('r1', 'wf', 'ws', 7, 'push', '{}', 'success')", nil},
		{"INSERT INTO workflow_jobs (id, run_id, workspace_id, name, runs_on, status) VALUES ('j1', 'r1', 'ws', 'build', '[\"ubuntu-latest\"]', 'success')", nil},
		{"INSERT INTO workflow_job_logs (job_id, line_no, content) VALUES ('j1', 1, 'one'), ('j1', 2, 'two')", nil},
		{"INSERT INTO settings (key, value) VALUES ('runner_token', 'x')", nil},
		{"INSERT INTO workflow_vars (id, workspace_id, key, value) VALUES ('wv', 'ws', 'KEY', 'v')", nil},
		{"INSERT INTO files (workspace_id, id, name, original_filename, size, ext, width, height) VALUES ('ws', 'f1', 'f1.png', 'a.png', 1234567890123, '.png', 10, NULL)", nil},
		{"INSERT INTO note_files (workspace_id, note_id, comment_id, file_name) VALUES ('ws', 'n1', '', 'f1.png')", nil},
		{"INSERT INTO backfills (name, completed_at) VALUES ('note_files', 'now')", nil},
	}
	for _, s := range stmts {
		if _, err := db.Exec(s.query, s.args...); err != nil {
			t.Fatalf("%s: %v", s.query, err)
		}
	}
}

// dump renders every table of a sqlite database as sorted text rows.
func dump(t *testing.T, e Endpoint) map[string][]string {
	t.Helper()
	db, err := sql.Open(e.Driver, e.DSN)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	out := map[string][]string{}
	for _, tb := range tables {
		rows, err := db.Query("SELECT * FROM " + tb.name)
		if err != nil {
			t.Fatal(err)
		}
		cols, _ := rows.Columns()
		for rows.Next() {
			vals := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				t.Fatal(err)
			}
			parts := make([]string, len(cols))
			for i, v := range vals {
				switch x := v.(type) {
				case nil:
					parts[i] = cols[i] + "=NULL"
				case []byte:
					parts[i] = fmt.Sprintf("%s=%x", cols[i], x)
				case bool:
					if x {
						parts[i] = cols[i] + "=1"
					} else {
						parts[i] = cols[i] + "=0"
					}
				default:
					parts[i] = fmt.Sprintf("%s=%v", cols[i], x)
				}
			}
			out[tb.name] = append(out[tb.name], strings.Join(parts, " "))
		}
		rows.Close()
		sort.Strings(out[tb.name])
	}
	return out
}

func checkCopied(t *testing.T, got map[string][]string) {
	t.Helper()
	counts := map[string]int{
		"users": 2, "workspaces": 1, "workspace_users": 1, "notes": 3, "comments": 1,
		"views": 2, "view_objects": 1, "yjs_documents": 1, "workflow_job_logs": 2,
		"settings": 1, "workflow_vars": 1, "files": 1, "note_files": 1, "backfills": 1,
	}
	for name, want := range counts {
		if len(got[name]) != want {
			t.Errorf("%s: got %d rows, want %d: %v", name, len(got[name]), want, got[name])
		}
	}
	notes := strings.Join(got["notes"], "\n")
	for _, want := range []string{"id=n1 title=根", "id=n2 title=child", "parent_id=n1", "pinned=1"} {
		if !strings.Contains(notes, want) {
			t.Errorf("notes missing %q:\n%s", want, notes)
		}
	}
	// Root and dangling parents both become NULL.
	if strings.Count(notes, "parent_id=NULL") != 2 {
		t.Errorf("want 2 root notes:\n%s", notes)
	}
	if !strings.Contains(got["yjs_documents"][0], "data=000102ff00") {
		t.Errorf("binary data changed: %v", got["yjs_documents"])
	}
	if !strings.Contains(got["files"][0], "size=1234567890123") || !strings.Contains(got["files"][0], "height=NULL") {
		t.Errorf("files: %v", got["files"])
	}
}

func TestCopySqliteToSqlite(t *testing.T) {
	src, dst := newSqlite(t, "src.db"), newSqlite(t, "dst.db")
	seed(t, src)

	if err := Copy(src, dst, io.Discard); err != nil {
		t.Fatal(err)
	}
	checkCopied(t, dump(t, dst))

	// A second copy must refuse to mix data into a non-empty target.
	if err := Copy(src, dst, io.Discard); err == nil || !strings.Contains(err.Error(), "already has") {
		t.Fatalf("expected non-empty target error, got %v", err)
	}
}

func TestCopyThroughMySQL(t *testing.T) {
	testCopyThrough(t, newMySQL(t))
}

func TestCopyThroughPostgres(t *testing.T) {
	testCopyThrough(t, newPostgres(t))
}

// testCopyThrough goes sqlite -> mid -> sqlite and expects the same rows as
// a direct sqlite copy.
func testCopyThrough(t *testing.T, mid Endpoint) {
	src, direct, back := newSqlite(t, "src.db"), newSqlite(t, "direct.db"), newSqlite(t, "back.db")
	seed(t, src)

	if err := Copy(src, direct, io.Discard); err != nil {
		t.Fatal(err)
	}
	if err := Copy(src, mid, io.Discard); err != nil {
		t.Fatalf("sqlite -> %s: %v", mid.Driver, err)
	}
	if err := Copy(mid, back, io.Discard); err != nil {
		t.Fatalf("%s -> sqlite: %v", mid.Driver, err)
	}

	want, got := dump(t, direct), dump(t, back)
	for _, tb := range tables {
		if strings.Join(want[tb.name], "\n") != strings.Join(got[tb.name], "\n") {
			t.Errorf("%s differs after round trip:\nwant %v\ngot  %v", tb.name, want[tb.name], got[tb.name])
		}
	}
	checkCopied(t, got)
}
