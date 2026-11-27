package postgresdb

import (
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
)

// The search index queries are shared by all drivers; see db/search_query.go.

func (s PostgresDB) FindNotesToIndex(limit int) ([]string, error) {
	return db.FindNotesToIndex(s.getDB(), limit)
}

func (s PostgresDB) CountUnindexedNotes(workspaceID string) (int64, error) {
	return db.CountUnindexedNotes(s.getDB(), workspaceID)
}

func (s PostgresDB) ClaimNoteForIndexing(noteID string) (bool, error) {
	return db.ClaimNoteForIndexing(s.getDB(), noteID)
}

func (s PostgresDB) ResetSearchClaims() error {
	return db.ResetSearchClaims(s.getDB())
}

func (s PostgresDB) MarkNoteUnindexed(noteID string) error {
	return db.MarkNoteUnindexed(s.getDB(), noteID)
}

func (s PostgresDB) ReplaceNoteSearchIndex(workspaceID, noteID string, idx model.NoteSearchIndex, indexedAt string) (bool, error) {
	return db.ReplaceNoteSearchIndex(s.getDB(), workspaceID, noteID, idx, indexedAt)
}

func (s PostgresDB) DeleteNoteSearchIndex(noteID string) error {
	return db.DeleteNoteSearchIndex(s.getDB(), noteID)
}

func (s PostgresDB) DeleteOrphanSearchIndex() (int64, error) {
	return db.DeleteOrphanSearchIndex(s.getDB())
}

func (s PostgresDB) SearchNotes(f model.SearchFilter) ([]model.Note, error) {
	return db.SearchNotes(s.getDB(), f)
}

func (s PostgresDB) FindNoteTags(noteIDs []string) ([]model.NoteTag, error) {
	return db.FindNoteTags(s.getDB(), noteIDs)
}

func (s PostgresDB) FindNoteLocations(noteIDs []string) ([]model.NoteLocation, error) {
	return db.FindNoteLocations(s.getDB(), noteIDs)
}

func (s PostgresDB) FindNoteEvents(noteIDs []string) ([]model.NoteEvent, error) {
	return db.FindNoteEvents(s.getDB(), noteIDs)
}

func (s PostgresDB) FindTags(workspaceID, userID, prefix string, limit int) ([]model.TagCount, error) {
	return db.FindTags(s.getDB(), workspaceID, userID, prefix, limit)
}
