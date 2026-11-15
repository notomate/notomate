package postgresdb

import (
	"context"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateNote(n model.Note) error {
	return gorm.G[model.Note](s.getDB()).Create(context.Background(), &n)
}

func (s PostgresDB) UpdateNote(n model.Note) error {
	// Any change makes the search index stale; the indexer picks the note
	// up again (see internal/search).
	n.SearchIndexedAt = nil
	_, err := gorm.G[model.Note](s.getDB()).
		Where("id = ?", n.ID).
		Select("title", "content", "visibility", "parent_id", "pinned", "updated_at", "updated_by", "search_indexed_at").
		Updates(context.Background(), n)
	return err
}

func (s PostgresDB) DeleteNote(n model.Note) error {
	_, err := gorm.G[model.Note](s.getDB()).Where("id = ?", n.ID).Delete(context.Background())
	return err
}

func (s PostgresDB) FindNote(n model.Note) (model.Note, error) {
	note, err := gorm.
		G[model.Note](s.getDB()).
		Where("id = ?", n.ID).
		Take(context.Background())

	return note, err
}

func (s PostgresDB) FindNotes(f model.NoteFilter) ([]model.Note, error) {
	return db.FindNotes(s.getDB(), f)
}

func (s PostgresDB) GetNoteCountsByDate(workspaceID string, startDate string, timezoneOffsetMinutes int) (map[string]int, error) {
	type Result struct {
		Date  string
		Count int
	}

	var results []Result

	// Since created_at is stored as TEXT, we use SUBSTRING to extract the date
	// Format is like "2025-12-22 12:13:56.558180165 +0000 UTC"
	// We extract the first 10 characters (YYYY-MM-DD)

	// Note: Timezone offset is not supported when using TEXT type for dates
	// For proper timezone support, consider migrating to TIMESTAMP type
	var query string
	query = `
		SELECT
			SUBSTRING(created_at, 1, 10) as date,
			COUNT(*) as count
		FROM notes
		WHERE workspace_id = $1
		AND SUBSTRING(created_at, 1, 10) >= $2
		GROUP BY SUBSTRING(created_at, 1, 10)
		ORDER BY date
	`
	err := s.getDB().
		Raw(query, workspaceID, startDate).
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
