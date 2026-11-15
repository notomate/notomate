package db

import (
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

// The search index queries are plain SQL that MySQL, PostgreSQL and SQLite
// all accept, so the drivers share them instead of keeping three copies.

// SearchIndexing marks a note the indexer has claimed. A note update in the
// meantime resets it to NULL, so the finished index is only recorded when
// the note is still unchanged.
const SearchIndexing = "indexing"

// likeEscape is the LIKE escape character. '!' rather than '\' because
// MySQL treats a backslash inside a string literal as an escape itself.
const likeEscape = "!"

// EscapeLike makes s match literally inside a LIKE pattern.
func EscapeLike(s string) string {
	r := strings.NewReplacer(likeEscape, likeEscape+likeEscape, "%", likeEscape+"%", "_", likeEscape+"_")
	return r.Replace(s)
}

// visibleNote limits notes (by alias) to those the user may see, the same
// rule FindNotes uses: public and workspace notes, and the user's own
// private notes. Without a user only public notes are visible.
func visibleNote(g *gorm.DB, alias, userID string) *gorm.DB {
	if userID == "" {
		return g.Where(alias + ".visibility = 'public'")
	}
	return g.Where("("+alias+".visibility IN ('public', 'workspace') OR ("+alias+".visibility = 'private' AND "+alias+".created_by = ?))", userID)
}

func FindNotesToIndex(g *gorm.DB, limit int) ([]string, error) {
	var ids []string
	err := g.Model(&model.Note{}).
		Where("search_indexed_at IS NULL").
		Order("updated_at").
		Limit(limit).
		Pluck("id", &ids).Error
	return ids, err
}

func CountUnindexedNotes(g *gorm.DB, workspaceID string) (int64, error) {
	var n int64
	err := g.Model(&model.Note{}).
		Where("workspace_id = ? AND (search_indexed_at IS NULL OR search_indexed_at = ?)", workspaceID, SearchIndexing).
		Count(&n).Error
	return n, err
}

// ClaimNoteForIndexing marks a pending note as being indexed. It reports
// false when the note is gone or no longer pending.
func ClaimNoteForIndexing(g *gorm.DB, noteID string) (bool, error) {
	res := g.Model(&model.Note{}).
		Where("id = ? AND search_indexed_at IS NULL", noteID).
		Update("search_indexed_at", SearchIndexing)
	return res.RowsAffected > 0, res.Error
}

// ResetSearchClaims returns notes left claimed by an interrupted indexer to
// the pending state.
func ResetSearchClaims(g *gorm.DB) error {
	return g.Model(&model.Note{}).
		Where("search_indexed_at = ?", SearchIndexing).
		Update("search_indexed_at", nil).Error
}

func MarkNoteUnindexed(g *gorm.DB, noteID string) error {
	return g.Model(&model.Note{}).
		Where("id = ?", noteID).
		Update("search_indexed_at", nil).Error
}

// maxTxAttempts bounds retries of a transaction the database aborted to
// resolve a deadlock.
const maxTxAttempts = 3

// isRetryable reports whether err is a deadlock or serialization failure,
// after which the whole transaction can simply be run again. MySQL hits
// these when concurrent index writers' DELETEs take overlapping gap locks.
func isRetryable(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	for _, s := range []string{"Error 1213", "Deadlock found", "SQLSTATE 40001", "SQLSTATE 40P01", "database is locked"} {
		if strings.Contains(msg, s) {
			return true
		}
	}
	return false
}

// ReplaceNoteSearchIndex stores a note's index and, if the note is still
// claimed (unchanged since it was read), records it as indexed at
// indexedAt. It reports whether the note was recorded as indexed.
func ReplaceNoteSearchIndex(g *gorm.DB, workspaceID, noteID string, idx model.NoteSearchIndex, indexedAt string) (marked bool, err error) {
	for attempt := 1; ; attempt++ {
		marked, err = replaceNoteSearchIndex(g, workspaceID, noteID, idx, indexedAt)
		if !isRetryable(err) || attempt == maxTxAttempts {
			return marked, err
		}
	}
}

func replaceNoteSearchIndex(g *gorm.DB, workspaceID, noteID string, idx model.NoteSearchIndex, indexedAt string) (bool, error) {
	marked := false
	err := g.Transaction(func(tx *gorm.DB) error {
		if err := deleteNoteSearchIndex(tx, noteID); err != nil {
			return err
		}
		if err := tx.Create(&model.NoteSearch{NoteID: noteID, WorkspaceID: workspaceID, Body: idx.Body}).Error; err != nil {
			return err
		}
		if len(idx.Tags) > 0 {
			if err := tx.CreateInBatches(idx.Tags, 200).Error; err != nil {
				return err
			}
		}
		if len(idx.Locations) > 0 {
			if err := tx.CreateInBatches(idx.Locations, 200).Error; err != nil {
				return err
			}
		}
		res := tx.Model(&model.Note{}).
			Where("id = ? AND search_indexed_at = ?", noteID, SearchIndexing).
			Update("search_indexed_at", indexedAt)
		marked = res.RowsAffected > 0
		return res.Error
	})
	return marked, err
}

func deleteNoteSearchIndex(tx *gorm.DB, noteID string) error {
	for _, m := range []any{&model.NoteSearch{}, &model.NoteTag{}, &model.NoteLocation{}} {
		if err := tx.Where("note_id = ?", noteID).Delete(m).Error; err != nil {
			return err
		}
	}
	return nil
}

func DeleteNoteSearchIndex(g *gorm.DB, noteID string) error {
	return g.Transaction(func(tx *gorm.DB) error { return deleteNoteSearchIndex(tx, noteID) })
}

// DeleteOrphanSearchIndex removes index rows of notes that no longer exist
// (e.g. deleted with their workspace).
func DeleteOrphanSearchIndex(g *gorm.DB) (int64, error) {
	var total int64
	for _, m := range []any{&model.NoteSearch{}, &model.NoteTag{}, &model.NoteLocation{}} {
		res := g.Where("NOT EXISTS (SELECT 1 FROM notes WHERE notes.id = note_id)").Delete(m)
		if res.Error != nil {
			return total, res.Error
		}
		total += res.RowsAffected
	}
	return total, nil
}

func SearchNotes(g *gorm.DB, f model.SearchFilter) ([]model.Note, error) {
	q := g.Model(&model.Note{}).Select("notes.*").Where("notes.workspace_id = ?", f.WorkspaceID)
	q = visibleNote(q, "notes", f.UserID)

	if len(f.Terms) > 0 {
		q = q.Joins("JOIN note_search ON note_search.note_id = notes.id")
		for _, t := range f.Terms {
			q = q.Where("note_search.body LIKE ? ESCAPE '"+likeEscape+"'", "%"+EscapeLike(t)+"%")
		}
	}

	if len(f.Tags) > 0 {
		sub := g.Model(&model.NoteTag{}).
			Select("note_id").
			Where("workspace_id = ? AND tag_norm IN ?", f.WorkspaceID, f.Tags).
			Group("note_id")
		if !f.MatchAnyTag {
			sub = sub.Having("COUNT(*) = ?", len(f.Tags))
		}
		q = q.Where("notes.id IN (?)", sub)
	}

	if b := f.BBox; b != nil {
		lngCond := "l.lng BETWEEN ? AND ?"
		if b.MinLng > b.MaxLng { // crosses the antimeridian
			lngCond = "(l.lng >= ? OR l.lng <= ?)"
		}
		q = q.Where("EXISTS (SELECT 1 FROM note_locations l WHERE l.note_id = notes.id AND l.lat BETWEEN ? AND ? AND "+lngCond+")",
			b.MinLat, b.MaxLat, b.MinLng, b.MaxLng)
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

	// Same rules as FindNotes: content is compact TipTap JSON, so a node
	// shows up as "type":"<name>" (names are validated identifiers).
	if len(f.BlockTypes) > 0 {
		conds := make([]string, len(f.BlockTypes))
		args := make([]any, len(f.BlockTypes))
		for i, t := range f.BlockTypes {
			conds[i] = "notes.content LIKE ?"
			args[i] = `%"type":"` + t + `"%`
		}
		q = q.Where("("+strings.Join(conds, " OR ")+")", args...)
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

func FindNoteTags(g *gorm.DB, noteIDs []string) ([]model.NoteTag, error) {
	var tags []model.NoteTag
	if len(noteIDs) == 0 {
		return tags, nil
	}
	err := g.Where("note_id IN ?", noteIDs).Order("note_id").Order("tag_norm").Find(&tags).Error
	return tags, err
}

func FindNoteLocations(g *gorm.DB, noteIDs []string) ([]model.NoteLocation, error) {
	var locs []model.NoteLocation
	if len(noteIDs) == 0 {
		return locs, nil
	}
	err := g.Where("note_id IN ?", noteIDs).Order("note_id").Order("seq").Find(&locs).Error
	return locs, err
}

// FindTags lists the workspace's tags visible to the user, most used first,
// optionally only those starting with prefix (normalized).
func FindTags(g *gorm.DB, workspaceID, userID, prefix string, limit int) ([]model.TagCount, error) {
	q := g.Table("note_tags t").
		Select("MIN(t.tag) AS tag, COUNT(*) AS count").
		Joins("JOIN notes n ON n.id = t.note_id").
		Where("t.workspace_id = ?", workspaceID)
	q = visibleNote(q, "n", userID)
	if prefix != "" {
		q = q.Where("t.tag_norm LIKE ? ESCAPE '"+likeEscape+"'", EscapeLike(prefix)+"%")
	}
	var out []model.TagCount
	err := q.Group("t.tag_norm").
		Order("COUNT(*) DESC").Order("t.tag_norm").
		Limit(limit).
		Scan(&out).Error
	return out, err
}
