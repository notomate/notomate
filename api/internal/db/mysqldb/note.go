package mysqldb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s MySQLDB) CreateNote(n model.Note) error {
	return gorm.G[model.Note](s.getDB()).Create(context.Background(), &n)
}

func (s MySQLDB) UpdateNote(n model.Note) error {
	_, err := gorm.G[model.Note](s.getDB()).
		Where("id = ?", n.ID).
		Select("title", "content", "visibility", "parent_id", "pinned", "updated_at", "updated_by").
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

	if f.PinnedOnly {
		conds = append(conds, "pinned = ?")
		args = append(args, true)
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
