package search

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
)

// panicDB claims every note and panics when the note is read.
type panicDB struct {
	db.DB
	unindexed []string
}

func (p *panicDB) ClaimNoteForIndexing(string) (bool, error) { return true, nil }

func (p *panicDB) FindNote(model.Note) (model.Note, error) { panic("boom") }

func (p *panicDB) MarkNoteUnindexed(id string) error {
	p.unindexed = append(p.unindexed, id)
	return nil
}

func TestIndexNoteRecoversPanic(t *testing.T) {
	fake := &panicDB{}
	ix := NewIndexer(fake, Options{})

	err := ix.IndexNote("n1")
	if err == nil || !strings.Contains(err.Error(), "boom") {
		t.Fatalf("want panic turned into error, got %v", err)
	}
	if len(fake.unindexed) != 1 || fake.unindexed[0] != "n1" {
		t.Fatalf("note should be returned to pending, got %v", fake.unindexed)
	}
}

// memDB is a pending set of notes; the first ResetSearchClaims fails as if
// the api were still migrating the database.
type memDB struct {
	db.DB
	mu         sync.Mutex
	resets     int
	pending    map[string]bool
	indexed    map[string]string
	allIndexed chan struct{}
}

func (m *memDB) ResetSearchClaims() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resets++
	if m.resets == 1 {
		return errors.New("no such column: search_indexed_at")
	}
	return nil
}

func (m *memDB) DeleteOrphanSearchIndex() (int64, error) { return 0, nil }

func (m *memDB) FindNotesToIndex(limit int) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var ids []string
	for id := range m.pending {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	if len(ids) > limit {
		ids = ids[:limit]
	}
	return ids, nil
}

func (m *memDB) ClaimNoteForIndexing(id string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.pending[id], nil
}

func (m *memDB) FindNote(n model.Note) (model.Note, error) {
	return model.Note{ID: n.ID, WorkspaceID: "ws", Title: "Title " + n.ID}, nil
}

func (m *memDB) FindComments(model.CommentFilter) ([]model.Comment, error) { return nil, nil }

func (m *memDB) ReplaceNoteSearchIndex(_, id string, idx model.NoteSearchIndex, _ string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.pending, id)
	m.indexed[id] = idx.Body
	if len(m.pending) == 0 {
		close(m.allIndexed)
	}
	return true, nil
}

func TestRunIndexesBacklogAndStops(t *testing.T) {
	m := &memDB{pending: map[string]bool{}, indexed: map[string]string{}, allIndexed: make(chan struct{})}
	for i := 0; i < 25; i++ {
		m.pending[fmt.Sprintf("n%02d", i)] = true
	}
	// A batch smaller than the backlog, so several scans are needed.
	ix := NewIndexer(m, Options{BatchSize: 10, ScanInterval: 20 * time.Millisecond})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { ix.Run(ctx); close(done) }()

	select {
	case <-m.allIndexed:
	case <-time.After(5 * time.Second):
		t.Fatalf("not all notes indexed: %d pending", len(m.pending))
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not return after cancel")
	}
	if m.resets < 2 {
		t.Errorf("claims reset should be retried, got %d attempts", m.resets)
	}
	if got := m.indexed["n07"]; got != "title n07" {
		t.Errorf("body of n07: %q", got)
	}
}
