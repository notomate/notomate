package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	migratesqlite3 "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db/sqlitedb"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage/localfile"
)

const tusBase = "/api/v1/uploads/"

type tusTestEnv struct {
	h        *Handler
	uploads  *ResumableUploads
	tmpDir   string
	storeDir string
	member   model.User
	outsider model.User
}

func setupTusTest(t *testing.T) tusTestEnv {
	t.Helper()

	config.Init()
	// Not t.TempDir(): the gorm sqlite pool stays open past the test, which
	// makes TempDir cleanup fail on Windows.
	dir, err := os.MkdirTemp("", "tus-upload-test")
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
	m, err := migrate.NewWithDatabaseInstance("file://../../../migrations/sqlite3", "main", driver)
	if err != nil {
		t.Fatalf("migrate instance: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("apply migrations: %v", err)
	}
	sqlDB.Close()

	database, err := sqlitedb.NewSqliteDB()
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	member := model.User{ID: "u-member", Email: "member@example.com", Name: "member"}
	outsider := model.User{ID: "u-outsider", Email: "outsider@example.com", Name: "outsider"}
	for _, u := range []model.User{member, outsider} {
		if err := database.CreateUser(u); err != nil {
			t.Fatalf("create user: %v", err)
		}
	}
	if err := database.CreateWorkspace(model.Workspace{ID: "ws1", Name: "ws"}); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	if err := database.CreateWorkspaceUser(model.WorkspaceUser{WorkspaceID: "ws1", UserID: member.ID, Role: model.WorkspaceUserRoleOwner}); err != nil {
		t.Fatalf("create workspace user: %v", err)
	}

	storeDir := filepath.Join(dir, "uploads")
	tmpDir := filepath.Join(dir, "tus")
	h := NewHandler(database, localfile.NewLocalFileStorage(filepath.ToSlash(storeDir)+"/"))
	uploads, err := h.NewResumableUploads(tusBase, tmpDir, 0)
	if err != nil {
		t.Fatalf("new resumable uploads: %v", err)
	}
	return tusTestEnv{h: h, uploads: uploads, tmpDir: tmpDir, storeDir: storeDir, member: member, outsider: outsider}
}

func tusMeta(pairs ...string) string {
	var parts []string
	for i := 0; i < len(pairs); i += 2 {
		parts = append(parts, pairs[i]+" "+base64.StdEncoding.EncodeToString([]byte(pairs[i+1])))
	}
	return strings.Join(parts, ",")
}

func (env tusTestEnv) do(t *testing.T, user model.User, method, path string, header map[string]string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Tus-Resumable", "1.0.0")
	for k, v := range header {
		req.Header.Set(k, v)
	}
	req = req.WithContext(ContextWithUser(req.Context(), user))
	rec := httptest.NewRecorder()
	env.uploads.Handler().ServeHTTP(rec, req)
	return rec
}

func TestResumableUploadPersistsFile(t *testing.T) {
	env := setupTusTest(t)
	content := []byte("hello resumable world")

	rec := env.do(t, env.member, http.MethodPost, tusBase, map[string]string{
		"Upload-Length":   strconv.Itoa(len(content)),
		"Upload-Metadata": tusMeta("workspaceId", "ws1", "filename", "報告.txt", "filetype", "text/plain"),
	}, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: status %d body %q", rec.Code, rec.Body.String())
	}
	location := rec.Header().Get("Location")
	if !strings.HasPrefix(location, tusBase) {
		t.Fatalf("expected relative location under %s, got %q", tusBase, location)
	}
	id := strings.TrimPrefix(location, tusBase)

	if err := env.uploads.Authorize(context.Background(), id, env.outsider); err == nil {
		t.Fatalf("expected outsider to be refused access to the upload")
	}

	// First chunk, then resume from the offset reported by HEAD.
	rec = env.do(t, env.member, http.MethodPatch, location, map[string]string{
		"Upload-Offset": "0",
		"Content-Type":  "application/offset+octet-stream",
	}, content[:8])
	if rec.Code != http.StatusNoContent {
		t.Fatalf("patch 1: status %d body %q", rec.Code, rec.Body.String())
	}
	rec = env.do(t, env.member, http.MethodHead, location, nil, nil)
	if got := rec.Header().Get("Upload-Offset"); got != "8" {
		t.Fatalf("expected offset 8 after first chunk, got %q", got)
	}
	rec = env.do(t, env.member, http.MethodPatch, location, map[string]string{
		"Upload-Offset": "8",
		"Content-Type":  "application/offset+octet-stream",
	}, content[8:])
	if rec.Code != http.StatusNoContent {
		t.Fatalf("patch 2: status %d body %q", rec.Code, rec.Body.String())
	}

	fileID := rec.Header().Get(HeaderFileID)
	fileName := rec.Header().Get(HeaderFileName)
	if fileID == "" || fileName == "" {
		t.Fatalf("missing file headers: %v", rec.Header())
	}

	file, err := env.h.db.FindFileByID(fileID)
	if err != nil {
		t.Fatalf("find file: %v", err)
	}
	if file.OriginalFilename != "報告.txt" || file.Size != int64(len(content)) || file.WorkspaceID != "ws1" || file.CreatedBy != env.member.ID {
		t.Fatalf("unexpected file record: %+v", file)
	}

	stored, err := os.ReadFile(filepath.Join(env.storeDir, "ws1", fileName))
	if err != nil {
		t.Fatalf("read stored file: %v", err)
	}
	if !bytes.Equal(stored, content) {
		t.Fatalf("stored content mismatch: %q", stored)
	}

	if _, err := os.Stat(filepath.Join(env.tmpDir, id)); !os.IsNotExist(err) {
		t.Fatalf("expected staged upload to be removed, stat err = %v", err)
	}
}

func TestResumableUploadRejectsNonMember(t *testing.T) {
	env := setupTusTest(t)

	rec := env.do(t, env.outsider, http.MethodPost, tusBase, map[string]string{
		"Upload-Length":   "4",
		"Upload-Metadata": tusMeta("workspaceId", "ws1", "filename", "a.txt"),
	}, nil)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-member, got %d", rec.Code)
	}

	rec = env.do(t, env.member, http.MethodPost, tusBase, map[string]string{
		"Upload-Length":   "4",
		"Upload-Metadata": tusMeta("filename", "a.txt"),
	}, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 without workspaceId, got %d", rec.Code)
	}
}
