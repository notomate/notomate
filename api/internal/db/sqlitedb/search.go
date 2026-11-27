package sqlitedb

import (
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
)

// The search index queries are shared by all drivers; see db/search_query.go.

func (s SqliteDB) FindNotesToIndex(limit int) ([]string, error) {
	return db.FindNotesToIndex(s.getDB(), limit)
}

func (s SqliteDB) CountUnindexedNotes(workspaceID string) (int64, error) {
	return db.CountUnindexedNotes(s.getDB(), workspaceID)
}

func (s SqliteDB) ClaimNoteForIndexing(noteID string) (bool, error) {
	return db.ClaimNoteForIndexing(s.getDB(), noteID)
}

func (s SqliteDB) ResetSearchClaims() error {
	return db.ResetSearchClaims(s.getDB())
}

func (s SqliteDB) MarkNoteUnindexed(noteID string) error {
	return db.MarkNoteUnindexed(s.getDB(), noteID)
}

func (s SqliteDB) ReplaceNoteSearchIndex(workspaceID, noteID string, idx model.NoteSearchIndex, indexedAt string) (bool, error) {
	return db.ReplaceNoteSearchIndex(s.getDB(), workspaceID, noteID, idx, indexedAt)
}

func (s SqliteDB) DeleteNoteSearchIndex(noteID string) error {
	return db.DeleteNoteSearchIndex(s.getDB(), noteID)
}

func (s SqliteDB) DeleteOrphanSearchIndex() (int64, error) {
	return db.DeleteOrphanSearchIndex(s.getDB())
}

func (s SqliteDB) SearchNotes(f model.SearchFilter) ([]model.Note, error) {
	return db.SearchNotes(s.getDB(), f)
}

func (s SqliteDB) FindNoteTags(noteIDs []string) ([]model.NoteTag, error) {
	return db.FindNoteTags(s.getDB(), noteIDs)
}

func (s SqliteDB) FindNoteLocations(noteIDs []string) ([]model.NoteLocation, error) {
	return db.FindNoteLocations(s.getDB(), noteIDs)
}

func (s SqliteDB) FindNoteEvents(noteIDs []string) ([]model.NoteEvent, error) {
	return db.FindNoteEvents(s.getDB(), noteIDs)
}

func (s SqliteDB) FindTags(workspaceID, userID, prefix string, limit int) ([]model.TagCount, error) {
	return db.FindTags(s.getDB(), workspaceID, userID, prefix, limit)
}
