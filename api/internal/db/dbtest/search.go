// Package dbtest holds repository tests shared by the database drivers.
package dbtest

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/search"
)

func noteContent(tags []string, lat, lng float64, text string) string {
	quoted := make([]string, len(tags))
	for i, t := range tags {
		quoted[i] = fmt.Sprintf("%q", t)
	}
	return fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":%q}]},`+
		`{"type":"tagsNode","attrs":{"tags":[%s]}},`+
		`{"type":"locationNode","attrs":{"lat":%v,"lng":%v,"name":"Place","address":""}}]}`,
		text, strings.Join(quoted, ","), lat, lng)
}

func ids(notes []model.Note) string {
	out := make([]string, len(notes))
	for i, n := range notes {
		out[i] = n.ID
	}
	sort.Strings(out)
	return strings.Join(out, ",")
}

func indexAll(t *testing.T, s db.DB) {
	t.Helper()
	ix := search.NewIndexer(s, search.Options{})
	pending, err := s.FindNotesToIndex(100)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range pending {
		if err := ix.IndexNote(id); err != nil {
			t.Fatalf("index %s: %v", id, err)
		}
	}
	if left, _ := s.FindNotesToIndex(100); len(left) != 0 {
		t.Fatalf("still pending after indexing: %v", left)
	}
}

// SearchIndex exercises the search index repository and the indexer on a
// freshly migrated, empty database. Each driver's tests run it.
func SearchIndex(t *testing.T, s db.DB) {
	if err := s.CreateWorkspace(model.Workspace{ID: "ws", Name: "ws"}); err != nil {
		t.Fatal(err)
	}
	for _, n := range []model.Note{
		{ID: "n1", Title: "Alpha 100%", Visibility: "public", CreatedBy: "u1", Content: noteContent([]string{"Work", "urgent"}, 25.03, 121.56, "taipei trip")},
		{ID: "n2", Title: "Beta", Visibility: "workspace", CreatedBy: "u1", Content: noteContent([]string{"work"}, 35.68, 139.76, "tokyo")},
		{ID: "n3", Title: "Gamma", Visibility: "private", CreatedBy: "u2", Content: noteContent([]string{"work"}, 25.1, 121.5, "secret")},
		{ID: "n4", Title: "Delta", Visibility: "public", CreatedBy: "u1", Content: noteContent(nil, 0, 179.5, "fiji")},
	} {
		n.WorkspaceID = "ws"
		n.CreatedAt, n.UpdatedAt = "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"
		if err := s.CreateNote(n); err != nil {
			t.Fatal(err)
		}
	}
	if pending, _ := s.CountUnindexedNotes("ws"); pending != 4 {
		t.Fatalf("pending before indexing: %d", pending)
	}
	indexAll(t, s)

	find := func(f model.SearchFilter) string {
		t.Helper()
		f.WorkspaceID = "ws"
		if f.UserID == "" {
			f.UserID = "u1"
		}
		f.PageSize, f.PageNumber = 50, 1
		notes, err := s.SearchNotes(f)
		if err != nil {
			t.Fatalf("search %+v: %v", f, err)
		}
		return ids(notes)
	}
	cases := []struct {
		name string
		f    model.SearchFilter
		want string
	}{
		{"tag hides others' private notes", model.SearchFilter{Tags: []string{"work"}}, "n1,n2"},
		{"own private note visible", model.SearchFilter{UserID: "u2", Tags: []string{"work"}}, "n1,n2,n3"},
		{"all tags", model.SearchFilter{Tags: []string{"work", "urgent"}}, "n1"},
		{"any tag", model.SearchFilter{Tags: []string{"work", "urgent"}, MatchAnyTag: true}, "n1,n2"},
		{"keyword in content", model.SearchFilter{Terms: search.Terms("TAIPEI")}, "n1"},
		{"keywords all match", model.SearchFilter{Terms: search.Terms("alpha tokyo")}, ""},
		{"literal percent", model.SearchFilter{Terms: []string{"100%"}}, "n1"},
		{"underscore is not a wildcard", model.SearchFilter{Terms: []string{"1_0"}}, ""},
		{"json keys are not text", model.SearchFilter{Terms: []string{"paragraph"}}, ""},
		{"bbox", model.SearchFilter{BBox: &model.BBox{MinLng: 121, MinLat: 24.5, MaxLng: 122, MaxLat: 25.5}}, "n1"},
		{"bbox across antimeridian", model.SearchFilter{BBox: &model.BBox{MinLng: 170, MinLat: -10, MaxLng: -170, MaxLat: 10}}, "n4"},
		{"bbox and keyword", model.SearchFilter{Terms: []string{"beta"}, BBox: &model.BBox{MinLng: 121, MinLat: 24.5, MaxLng: 122, MaxLat: 25.5}}, ""},
	}
	for _, c := range cases {
		if got := find(c.f); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}

	tags, err := s.FindTags("ws", "u1", "wo", 10)
	if err != nil || len(tags) != 1 || tags[0].Tag != "Work" && tags[0].Tag != "work" || tags[0].Count != 2 {
		t.Fatalf("tags: %+v err %v", tags, err)
	}

	tagRows, _ := s.FindNoteTags([]string{"n1"})
	locRows, _ := s.FindNoteLocations([]string{"n1"})
	if len(tagRows) != 2 || len(locRows) != 1 || locRows[0].Lat != 25.03 {
		t.Fatalf("note rows: %+v %+v", tagRows, locRows)
	}

	// Updating a note marks it pending; the old index keeps serving results
	// until it is rebuilt.
	n1, _ := s.FindNote(model.Note{ID: "n1"})
	n1.Content = noteContent([]string{"done"}, 25.03, 121.56, "taipei trip")
	if err := s.UpdateNote(n1); err != nil {
		t.Fatal(err)
	}
	if pending, _ := s.FindNotesToIndex(10); len(pending) != 1 || pending[0] != "n1" {
		t.Fatalf("pending after update: %v", pending)
	}
	if got := find(model.SearchFilter{Tags: []string{"urgent"}}); got != "n1" {
		t.Fatalf("stale index should still answer: %q", got)
	}
	indexAll(t, s)
	if got := find(model.SearchFilter{Tags: []string{"urgent"}}); got != "" {
		t.Fatalf("reindexed note kept its old tag: %q", got)
	}
	if got := find(model.SearchFilter{Tags: []string{"done"}}); got != "n1" {
		t.Fatalf("new tag not found: %q", got)
	}

	// A change while a note is being indexed leaves it pending.
	n2, _ := s.FindNote(model.Note{ID: "n2"})
	if err := s.MarkNoteUnindexed("n2"); err != nil {
		t.Fatal(err)
	}
	if ok, err := s.ClaimNoteForIndexing("n2"); !ok || err != nil {
		t.Fatalf("claim: %v %v", ok, err)
	}
	if ok, _ := s.ClaimNoteForIndexing("n2"); ok {
		t.Fatal("a claimed note must not be claimed twice")
	}
	if err := s.UpdateNote(n2); err != nil {
		t.Fatal(err)
	}
	marked, err := s.ReplaceNoteSearchIndex("ws", "n2", search.Extract("ws", "n2", n2.Title, n2.Content, nil), "2026-01-02T00:00:00Z")
	if err != nil || marked {
		t.Fatalf("index of a changed note must not be marked done: marked=%v err=%v", marked, err)
	}
	if pending, _ := s.FindNotesToIndex(10); len(pending) != 1 || pending[0] != "n2" {
		t.Fatalf("changed note should stay pending: %v", pending)
	}

	// Claims left by a stopped indexer go back to pending.
	if ok, _ := s.ClaimNoteForIndexing("n2"); !ok {
		t.Fatal("claim n2")
	}
	if err := s.ResetSearchClaims(); err != nil {
		t.Fatal(err)
	}
	if pending, _ := s.FindNotesToIndex(10); len(pending) != 1 {
		t.Fatalf("reset claims: %v", pending)
	}
	indexAll(t, s)

	// Index rows of deleted notes are cleaned up.
	if err := s.DeleteNote(model.Note{ID: "n4"}); err != nil {
		t.Fatal(err)
	}
	removed, err := s.DeleteOrphanSearchIndex()
	if err != nil || removed != 2 { // note_search + note_locations
		t.Fatalf("orphans removed: %d err %v", removed, err)
	}
	if pending, _ := s.CountUnindexedNotes("ws"); pending != 0 {
		t.Fatalf("pending at the end: %d", pending)
	}
}
