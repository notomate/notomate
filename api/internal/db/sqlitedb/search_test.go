package sqlitedb

import (
	"testing"

	"github.com/notomate/notomate/internal/db/dbtest"
)

func TestSearchIndex(t *testing.T) {
	dbtest.SearchIndex(t, newTestDB(t))
}

func TestFindNotes(t *testing.T) {
	dbtest.FindNotes(t, newTestDB(t))
}
