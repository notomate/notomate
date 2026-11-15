package db

import (
	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

// FindNotes lists notes for the workspace note list and Explore. Keywords and
// block types are matched against the search index (see internal/search), so
// a note edited moments ago matches its new content once it is reindexed.
func FindNotes(g *gorm.DB, f model.NoteFilter) ([]model.Note, error) {
	q := g.Model(&model.Note{}).Select("notes.*")
	if f.WorkspaceID != "" {
		q = q.Where("notes.workspace_id = ?", f.WorkspaceID)
	}
	q = visibleNote(q, "notes", f.UserID)

	if len(f.Terms) > 0 {
		q = q.Joins("JOIN note_search ON note_search.note_id = notes.id")
		for _, t := range f.Terms {
			q = q.Where("note_search.body LIKE ? ESCAPE '"+likeEscape+"'", "%"+EscapeLike(t)+"%")
		}
	}

	if f.ParentID == "null" {
		q = q.Where("(notes.parent_id IS NULL OR notes.parent_id = '')")
	} else if f.ParentID != "" {
		q = q.Where("notes.parent_id = ?", f.ParentID)
	}
	if f.PinnedOnly {
		q = q.Where("notes.pinned = ?", true)
	}
	if f.CreatedBy != "" {
		q = q.Where("notes.created_by = ?", f.CreatedBy)
	}
	if len(f.BlockTypes) > 0 { // any of them
		q = q.Where("EXISTS (SELECT 1 FROM note_blocks b WHERE b.note_id = notes.id AND b.type IN ?)", f.BlockTypes)
	}

	// Timestamps are text in RFC3339 or Go's time.String() layout; the first
	// 19 characters with ' ' read as 'T' compare correctly in both.
	dateCol := "notes.created_at"
	if f.DateField == "updated_at" {
		dateCol = "notes.updated_at"
	}
	if f.DateFrom != "" {
		q = q.Where("REPLACE(SUBSTR("+dateCol+", 1, 19), ' ', 'T') >= ?", f.DateFrom)
	}
	if f.DateTo != "" {
		q = q.Where("REPLACE(SUBSTR("+dateCol+", 1, 19), ' ', 'T') < ?", f.DateTo)
	}

	sortCol := "notes.created_at"
	if f.SortBy == "updated_at" {
		sortCol = "notes.updated_at"
	}
	var notes []model.Note
	err := q.Order(sortCol + " DESC").Order("notes.id").
		Offset((f.PageNumber - 1) * f.PageSize).
		Limit(f.PageSize).
		Find(&notes).Error
	return notes, err
}
