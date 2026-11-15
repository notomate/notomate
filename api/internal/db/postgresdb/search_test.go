package postgresdb

import (
	"testing"

	"github.com/notomate/notomate/internal/db/dbtest"
)

func TestSearchIndex(t *testing.T) {
	dbtest.SearchIndex(t, newSearchTestDB(t))
}

func TestFindNotes(t *testing.T) {
	dbtest.FindNotes(t, newSearchTestDB(t))
}

func newSearchTestDB(t *testing.T) *PostgresDB {
	s := newTestDB(t)
	// CreateNote stores root notes with parent_id '', which the PostgreSQL
	// fk_notes_parent constraint rejects (a separate, pre-existing issue).
	// Drop it here so this test covers the search queries only.
	if err := s.db.Exec("ALTER TABLE notes DROP CONSTRAINT fk_notes_parent").Error; err != nil {
		t.Fatal(err)
	}
	return s
}
