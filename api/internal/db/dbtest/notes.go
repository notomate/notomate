package dbtest

import (
	"strings"
	"testing"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/search"
)

// FindNotes exercises the note list filters on a freshly migrated, empty
// database: keywords and block types come from the search index, not from
// the raw TipTap JSON.
func FindNotes(t *testing.T, s db.DB) {
	for _, ws := range []string{"ws", "other"} {
		if err := s.CreateWorkspace(model.Workspace{ID: ws, Name: ws}); err != nil {
			t.Fatal(err)
		}
	}
	for _, n := range []model.Note{
		{ID: "img", Title: "Photos", Content: `{"type":"doc","content":[{"type":"image","attrs":{"src":"a.png"}}]}`, CreatedAt: "2026-01-01T10:00:00Z", UpdatedAt: "2026-03-01T10:00:00Z"},
		{ID: "todo", Title: "Groceries", Content: `{"type":"doc","content":[{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Buy MILK"}]}]}]}]}`, CreatedAt: "2026-01-05 08:00:00.123 +0000 UTC", UpdatedAt: "2026-01-05T08:00:00Z"},
		// "viewType" must not count as a block type.
		{ID: "view", Title: "Board", Content: `{"type":"doc","content":[{"type":"viewNode","attrs":{"viewType":"image"}}]}`, CreatedAt: "2026-02-01T00:00:00Z", UpdatedAt: "2026-02-01T00:00:00Z"},
		{ID: "secret", Title: "Milk plan", Visibility: "private", CreatedBy: "u2", Content: `{"type":"doc","content":[]}`, CreatedAt: "2026-02-02T00:00:00Z", UpdatedAt: "2026-02-02T00:00:00Z"},
		{ID: "team", WorkspaceID: "other", Title: "Milk run", Visibility: "workspace", CreatedBy: "u1", Content: `{"type":"doc","content":[]}`, CreatedAt: "2026-02-03T00:00:00Z", UpdatedAt: "2026-02-03T00:00:00Z"},
	} {
		if n.WorkspaceID == "" {
			n.WorkspaceID = "ws"
		}
		if n.Visibility == "" {
			n.Visibility = "public"
		}
		if err := s.CreateNote(n); err != nil {
			t.Fatalf("create note %s: %v", n.ID, err)
		}
	}
	indexAll(t, s)

	find := func(f model.NoteFilter) string {
		t.Helper()
		f.PageSize, f.PageNumber = 10, 1
		notes, err := s.FindNotes(f)
		if err != nil {
			t.Fatal(err)
		}
		return ids(notes)
	}
	inWS := func(f model.NoteFilter) model.NoteFilter { f.WorkspaceID, f.UserID = "ws", "u1"; return f }
	for _, c := range []struct {
		name string
		f    model.NoteFilter
		want string
	}{
		{"image", inWS(model.NoteFilter{BlockTypes: []string{"image"}}), "img"},
		{"image or task", inWS(model.NoteFilter{BlockTypes: []string{"image", "taskList"}}), "img,todo"},
		{"nested block type", inWS(model.NoteFilter{BlockTypes: []string{"taskItem"}}), "todo"},
		{"created range", inWS(model.NoteFilter{DateFrom: "2026-01-02T00:00:00", DateTo: "2026-02-01T00:00:00"}), "todo"},
		{"created from", inWS(model.NoteFilter{DateFrom: "2026-01-05T08:00:00"}), "todo,view"},
		{"updated range", inWS(model.NoteFilter{DateField: "updated_at", DateFrom: "2026-02-15T00:00:00"}), "img"},
		{"combined", inWS(model.NoteFilter{BlockTypes: []string{"image", "viewNode"}, DateTo: "2026-01-31T00:00:00"}), "img"},
		// Keywords match the note's text, case-insensitively, never the JSON.
		{"keyword in text", inWS(model.NoteFilter{Terms: search.Terms("milk")}), "todo"},
		{"keyword in title", inWS(model.NoteFilter{Terms: search.Terms("PHOTOS")}), "img"},
		{"all keywords", inWS(model.NoteFilter{Terms: search.Terms("buy milk")}), "todo"},
		{"json key", inWS(model.NoteFilter{Terms: search.Terms("type")}), ""},
		{"node type", inWS(model.NoteFilter{Terms: search.Terms("paragraph")}), ""},
		{"attribute url", inWS(model.NoteFilter{Terms: search.Terms("a.png")}), ""},
		// The owner sees their private note; others don't.
		{"private, owner", model.NoteFilter{WorkspaceID: "ws", UserID: "u2", Terms: search.Terms("milk")}, "secret,todo"},
		// Explore: every workspace, public notes only.
		{"explore", model.NoteFilter{Terms: search.Terms("milk")}, "todo"},
	} {
		if got := find(c.f); got != c.want {
			t.Errorf("%s: got %q want %q", c.name, got, c.want)
		}
	}

	// Sort order: newest first by default, oldest first with SortAsc.
	ordered := func(f model.NoteFilter) string {
		t.Helper()
		f.PageSize, f.PageNumber = 10, 1
		notes, err := s.FindNotes(inWS(f))
		if err != nil {
			t.Fatal(err)
		}
		out := make([]string, len(notes))
		for i, n := range notes {
			out[i] = n.ID
		}
		return strings.Join(out, ",")
	}
	for _, c := range []struct {
		name string
		f    model.NoteFilter
		want string
	}{
		{"created desc", model.NoteFilter{}, "view,todo,img"},
		{"created asc", model.NoteFilter{SortAsc: true}, "img,todo,view"},
		{"updated desc", model.NoteFilter{SortBy: "updated_at"}, "img,view,todo"},
		{"updated asc", model.NoteFilter{SortBy: "updated_at", SortAsc: true}, "todo,view,img"},
	} {
		if got := ordered(c.f); got != c.want {
			t.Errorf("order %s: got %q want %q", c.name, got, c.want)
		}
	}
}
