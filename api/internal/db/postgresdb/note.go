package postgresdb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateNote(n model.Note) error {
	return gorm.G[model.Note](s.getDB()).Create(context.Background(), &n)
}

func (s PostgresDB) UpdateNote(n model.Note) error {
	_, err := gorm.G[model.Note](s.getDB()).
		Where("id = ?", n.ID).
		Select("title", "content", "visibility", "parent_id", "updated_at", "updated_by").
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
	var notes []model.Note

	var conds []string
	var args []interface{}

	if f.WorkspaceID != "" {
		conds = append(conds, "workspace_id = ?")
		args = append(args, f.WorkspaceID)
	}

	if f.Query != "" {
		query := "%" + f.Query + "%"
		conds = append(conds, "(title LIKE ? OR content LIKE ?)")
		args = append(args, query, query)
	}

	if f.UserID != "" {
		permissionCond := `(
            visibility IN ('public', 'workspace')
            OR (visibility = 'private' AND created_by = ?)
        )`
		conds = append(conds, permissionCond)
		args = append(args, f.UserID)
	} else {
		conds = append(conds, "visibility = 'public'")
	}

	if f.ParentID == "null" {
		conds = append(conds, "(parent_id IS NULL OR parent_id = '')")
	} else if f.ParentID != "" {
		conds = append(conds, "parent_id = ?")
		args = append(args, f.ParentID)
	}

	query := s.getDB().Model(&model.Note{})

	if len(conds) > 0 {
		query = query.Where(strings.Join(conds, " AND "), args...)
	}

	sortCol := "created_at"
	if f.SortBy == "updated_at" {
		sortCol = "updated_at"
	}

	err := query.
		Order(sortCol + " DESC").
		Offset((f.PageNumber - 1) * f.PageSize).
		Limit(f.PageSize).
		Find(&notes).Error

	return notes, err
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
