package mysqldb

import (
	"context"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s MySQLDB) CreateNote(n model.Note) error {
	return gorm.G[model.Note](s.getDB()).Create(context.Background(), &n)
}

func (s MySQLDB) UpdateNote(n model.Note) error {
	// Any change makes the search index stale; the indexer picks the note
	// up again (see internal/search).
	n.SearchIndexedAt = nil
	_, err := gorm.G[model.Note](s.getDB()).
		Where("id = ?", n.ID).
		Select("title", "content", "visibility", "parent_id", "pinned", "updated_at", "updated_by", "search_indexed_at").
		Updates(context.Background(), n)
	return err
}

func (s MySQLDB) DeleteNote(n model.Note) error {
	_, err := gorm.G[model.Note](s.getDB()).Where("id = ?", n.ID).Delete(context.Background())
	return err
}

func (s MySQLDB) FindNote(n model.Note) (model.Note, error) {
	note, err := gorm.
		G[model.Note](s.getDB()).
		Where("id = ?", n.ID).
		Take(context.Background())

	return note, err
}

func (s MySQLDB) FindNotes(f model.NoteFilter) ([]model.Note, error) {
	return db.FindNotes(s.getDB(), f)
}

func (s MySQLDB) GetNoteCountsByDate(workspaceID string, startDate string, timezoneOffsetMinutes int) (map[string]int, error) {
	type Result struct {
		Date  string
		Count int
	}

	var results []Result

	// created_at is RFC3339 text (e.g. "2025-12-22T12:13:56Z"); parse the
	// first 19 characters as a UTC datetime and shift it by the offset. The
	// local date is computed once in a derived table so GROUP BY refers to a
	// plain column, as ONLY_FULL_GROUP_BY requires.
	query := `
		SELECT date, COUNT(*) as count
		FROM (
			SELECT SUBSTRING(DATE_ADD(STR_TO_DATE(REPLACE(SUBSTRING(created_at, 1, 19), 'T', ' '), '%Y-%m-%d %H:%i:%s'), INTERVAL ? MINUTE), 1, 10) as date
			FROM notes
			WHERE workspace_id = ?
		) local_notes
		WHERE date >= ?
		GROUP BY date
		ORDER BY date
	`
	err := s.getDB().
		Raw(query, timezoneOffsetMinutes, workspaceID, startDate).
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	// Convert to map
	counts := make(map[string]int)
	for _, r := range results {
		counts[r.Date] = r.Count
	}

	return counts, nil
}
