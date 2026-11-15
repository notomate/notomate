package sqlitedb

import (
	"context"
	"strconv"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s SqliteDB) CreateNote(n model.Note) error {
	return gorm.G[model.Note](s.getDB()).Create(context.Background(), &n)
}

func (s SqliteDB) UpdateNote(n model.Note) error {
	// Any change makes the search index stale; the indexer picks the note
	// up again (see internal/search).
	n.SearchIndexedAt = nil
	_, err := gorm.G[model.Note](s.getDB()).
		Where("id = ?", n.ID).
		Select("title", "content", "visibility", "parent_id", "pinned", "updated_at", "updated_by", "search_indexed_at").
		Updates(context.Background(), n)
	return err
}

func (s SqliteDB) DeleteNote(n model.Note) error {
	_, err := gorm.G[model.Note](s.getDB()).Where("id = ?", n.ID).Delete(context.Background())
	return err
}

func (s SqliteDB) FindNote(n model.Note) (model.Note, error) {
	note, err := gorm.
		G[model.Note](s.getDB()).
		Where("id = ?", n.ID).
		Take(context.Background())

	return note, err
}

func (s SqliteDB) FindNotes(f model.NoteFilter) ([]model.Note, error) {
	return db.FindNotes(s.getDB(), f)
}

func (s SqliteDB) GetNoteCountsByDate(workspaceID string, startDate string, timezoneOffsetMinutes int) (map[string]int, error) {
	type Result struct {
		Date  string
		Count int
	}

	var results []Result

	// Apply timezone offset: datetime(created_at, '+480 minutes') for UTC+8
	offsetStr := ""
	if timezoneOffsetMinutes != 0 {
		if timezoneOffsetMinutes > 0 {
			offsetStr = "+" + strconv.Itoa(timezoneOffsetMinutes) + " minutes"
		} else {
			offsetStr = strconv.Itoa(timezoneOffsetMinutes) + " minutes"
		}
	}

	var query string
	if offsetStr != "" {
		query = `
			SELECT
				substr(datetime(created_at, ?), 1, 10) as date,
				COUNT(*) as count
			FROM notes
			WHERE workspace_id = ?
			AND substr(datetime(created_at, ?), 1, 10) >= ?
			GROUP BY substr(datetime(created_at, ?), 1, 10)
			ORDER BY date
		`
		err := s.getDB().
			Raw(query, offsetStr, workspaceID, offsetStr, startDate, offsetStr).
			Scan(&results).Error
		if err != nil {
			return nil, err
		}
	} else {
		query = `
			SELECT
				substr(created_at, 1, 10) as date,
				COUNT(*) as count
			FROM notes
			WHERE workspace_id = ?
			AND substr(created_at, 1, 10) >= ?
			GROUP BY substr(created_at, 1, 10)
			ORDER BY date
		`
		err := s.getDB().
			Raw(query, workspaceID, startDate).
			Scan(&results).Error
		if err != nil {
			return nil, err
		}
	}

	// Convert to map
	counts := make(map[string]int)
	for _, r := range results {
		counts[r.Date] = r.Count
	}

	return counts, nil
}
