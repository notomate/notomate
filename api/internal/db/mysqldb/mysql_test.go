package mysqldb

import (
	"testing"

	"github.com/notomate/notomate/internal/model"
)

// Covers the queries that differ from the sqlite/postgres implementations or
// rely on MySQL-specific behaviour (reserved `key`, ON DUPLICATE KEY, dates).
func TestMySQLSpecificQueries(t *testing.T) {
	s := newTestDB(t)
	if err := s.CreateWorkspace(model.Workspace{ID: "ws", Name: "ws"}); err != nil {
		t.Fatal(err)
	}

	// Root notes store parent_id as '', so it must not be a foreign key.
	for _, n := range []model.Note{
		{ID: "n1", Title: "a", CreatedAt: "2026-01-01T23:30:00Z"},
		{ID: "n2", Title: "b", CreatedAt: "2026-01-02T01:00:00Z"},
		{ID: "n3", Title: "c", ParentID: "n1", CreatedAt: "2026-01-02T10:00:00Z"},
	} {
		n.WorkspaceID = "ws"
		n.Visibility = "public"
		if err := s.CreateNote(n); err != nil {
			t.Fatalf("create note %s: %v", n.ID, err)
		}
	}
	roots, err := s.FindNotes(model.NoteFilter{WorkspaceID: "ws", ParentID: "null", PageSize: 10, PageNumber: 1})
	if err != nil || len(roots) != 2 {
		t.Fatalf("root notes: %+v err %v", roots, err)
	}

	counts, err := s.GetNoteCountsByDate("ws", "2026-01-01", 0)
	if err != nil || counts["2026-01-01"] != 1 || counts["2026-01-02"] != 2 {
		t.Fatalf("utc counts: %v err %v", counts, err)
	}
	counts, err = s.GetNoteCountsByDate("ws", "2026-01-01", 60)
	if err != nil || counts["2026-01-02"] != 3 {
		t.Fatalf("utc+1 counts: %v err %v", counts, err)
	}

	if err := s.CreateWorkflowVar(model.WorkflowVar{ID: "v1", WorkspaceID: "ws", Key: "B", Value: "1"}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateWorkflowVar(model.WorkflowVar{ID: "v2", WorkspaceID: "ws", Key: "A", Value: "1"}); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateWorkflowVar("ws", "B", "2", "now", "u"); err != nil {
		t.Fatal(err)
	}
	vars, err := s.FindWorkflowVars("ws")
	if err != nil || len(vars) != 2 || vars[0].Key != "A" || vars[1].Value != "2" {
		t.Fatalf("vars: %+v err %v", vars, err)
	}
	if err := s.DeleteWorkflowVar("ws", "A"); err != nil {
		t.Fatal(err)
	}

	if err := s.CreateWorkflowSecret(model.WorkflowSecret{ID: "s1", WorkspaceID: "ws", Key: "TOKEN", ValueEncrypted: "x"}); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateWorkflowSecret("ws", "TOKEN", "y", "now", "u"); err != nil {
		t.Fatal(err)
	}
	secrets, err := s.FindWorkflowSecrets("ws")
	if err != nil || len(secrets) != 1 || secrets[0].ValueEncrypted != "y" {
		t.Fatalf("secrets: %+v err %v", secrets, err)
	}

	// ON CONFLICT DO NOTHING becomes ON DUPLICATE KEY UPDATE on MySQL.
	if err := s.ReplaceNoteFiles("ws", "n1", "", []string{"f.png", "f.png", "g.png"}); err != nil {
		t.Fatalf("replace note files: %v", err)
	}
	using, err := s.FindNotesUsingFile("ws", "f.png")
	if err != nil || len(using) != 1 || using[0].ID != "n1" {
		t.Fatalf("notes using file: %+v err %v", using, err)
	}
	if err := s.MarkBackfillDone("x"); err != nil {
		t.Fatal(err)
	}
	if err := s.MarkBackfillDone("x"); err != nil {
		t.Fatalf("mark backfill twice: %v", err)
	}
	if done, err := s.IsBackfillDone("x"); err != nil || !done {
		t.Fatalf("backfill done: %v err %v", done, err)
	}

	cache := model.GoogleMapsCache{CacheKey: "k", WorkspaceID: "ws", Kind: "photo", Ref: "r", Response: "1", ExpiresAt: "2099-01-01T00:00:00Z"}
	if err := s.UpsertGoogleMapsCache(cache); err != nil {
		t.Fatal(err)
	}
	cache.Response = "2"
	if err := s.UpsertGoogleMapsCache(cache); err != nil {
		t.Fatal(err)
	}
	got, err := s.FindGoogleMapsCache("k", "2026-01-01T00:00:00Z")
	if err != nil || got.Response != "2" {
		t.Fatalf("maps cache: %+v err %v", got, err)
	}
}
