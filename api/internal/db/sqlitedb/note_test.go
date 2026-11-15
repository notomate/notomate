package sqlitedb

import (
	"sort"
	"testing"

	"github.com/notomate/notomate/internal/model"
)

func TestFindNotesBlockTypeAndDateFilters(t *testing.T) {
	db := newTestDB(t)
	if err := db.CreateWorkspace(model.Workspace{ID: "ws", Name: "ws"}); err != nil {
		t.Fatal(err)
	}
	for _, n := range []model.Note{
		{ID: "img", Content: `{"type":"doc","content":[{"type":"image","attrs":{"src":"a"}}]}`, CreatedAt: "2026-01-01T10:00:00Z", UpdatedAt: "2026-03-01T10:00:00Z"},
		{ID: "todo", Content: `{"type":"doc","content":[{"type":"taskList","content":[]}]}`, CreatedAt: "2026-01-05 08:00:00.123 +0000 UTC", UpdatedAt: "2026-01-05T08:00:00Z"},
		// "viewType" must not count as a block type.
		{ID: "view", Content: `{"type":"doc","content":[{"type":"viewNode","attrs":{"viewType":"image"}}]}`, CreatedAt: "2026-02-01T00:00:00Z", UpdatedAt: "2026-02-01T00:00:00Z"},
	} {
		n.WorkspaceID = "ws"
		n.Visibility = "public"
		if err := db.CreateNote(n); err != nil {
			t.Fatalf("create note %s: %v", n.ID, err)
		}
	}

	ids := func(f model.NoteFilter) []string {
		t.Helper()
		f.WorkspaceID, f.PageSize, f.PageNumber = "ws", 10, 1
		notes, err := db.FindNotes(f)
		if err != nil {
			t.Fatal(err)
		}
		out := []string{}
		for _, n := range notes {
			out = append(out, n.ID)
		}
		sort.Strings(out)
		return out
	}
	check := func(name string, got []string, want ...string) {
		t.Helper()
		if len(got) != len(want) {
			t.Fatalf("%s: got %v want %v", name, got, want)
		}
		for i := range got {
			if got[i] != want[i] {
				t.Fatalf("%s: got %v want %v", name, got, want)
			}
		}
	}

	check("image", ids(model.NoteFilter{BlockTypes: []string{"image"}}), "img")
	check("image or task", ids(model.NoteFilter{BlockTypes: []string{"image", "taskList"}}), "img", "todo")
	check("created range", ids(model.NoteFilter{DateFrom: "2026-01-02T00:00:00", DateTo: "2026-02-01T00:00:00"}), "todo")
	check("created from", ids(model.NoteFilter{DateFrom: "2026-01-05T08:00:00"}), "todo", "view")
	check("updated range", ids(model.NoteFilter{DateField: "updated_at", DateFrom: "2026-02-15T00:00:00"}), "img")
	check("combined", ids(model.NoteFilter{BlockTypes: []string{"image", "viewNode"}, DateTo: "2026-01-31T00:00:00"}), "img")
}
