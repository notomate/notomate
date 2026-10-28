package postgresdb

import (
	"context"
	"time"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type backfill struct {
	Name        string
	CompletedAt string
}

// A file counts as used by a comment only while that comment exists.
const noteFileInUse = "(note_files.comment_id = '' OR EXISTS (SELECT 1 FROM comments WHERE comments.id = note_files.comment_id))"

func (s PostgresDB) ReplaceNoteFiles(workspaceID, noteID, commentID string, fileNames []string) error {
	return s.getDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("note_id = ? AND comment_id = ?", noteID, commentID).Delete(&model.NoteFile{}).Error; err != nil {
			return err
		}
		if len(fileNames) == 0 {
			return nil
		}
		rows := make([]model.NoteFile, 0, len(fileNames))
		for _, name := range fileNames {
			rows = append(rows, model.NoteFile{WorkspaceID: workspaceID, NoteID: noteID, CommentID: commentID, FileName: name})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
}

func (s PostgresDB) DeleteNoteFiles(noteID string) error {
	_, err := gorm.G[model.NoteFile](s.getDB()).Where("note_id = ?", noteID).Delete(context.Background())
	return err
}

func (s PostgresDB) DeleteCommentFiles(commentID string) error {
	if commentID == "" {
		return nil
	}
	_, err := gorm.G[model.NoteFile](s.getDB()).Where("comment_id = ?", commentID).Delete(context.Background())
	return err
}

func (s PostgresDB) FindNotesUsingFile(workspaceID, fileName string) ([]model.Note, error) {
	var notes []model.Note
	err := s.getDB().
		Model(&model.Note{}).
		Where("id IN (?)", s.getDB().
			Model(&model.NoteFile{}).
			Select("note_id").
			Where("workspace_id = ? AND file_name = ? AND "+noteFileInUse, workspaceID, fileName)).
		Order("updated_at DESC").
		Find(&notes).Error
	return notes, err
}

func (s PostgresDB) IsFileInPublicNote(workspaceID, fileName string) (bool, error) {
	var count int64
	err := s.getDB().
		Model(&model.NoteFile{}).
		Joins("JOIN notes ON notes.id = note_files.note_id").
		Where("note_files.workspace_id = ? AND note_files.file_name = ? AND notes.visibility = 'public' AND "+noteFileInUse, workspaceID, fileName).
		Limit(1).
		Count(&count).Error
	return count > 0, err
}

func (s PostgresDB) FindNotesAfter(afterID string, limit int) ([]model.Note, error) {
	return gorm.G[model.Note](s.getDB()).Where("id > ?", afterID).Order("id").Limit(limit).Find(context.Background())
}

func (s PostgresDB) FindCommentsAfter(afterID string, limit int) ([]model.Comment, error) {
	return gorm.G[model.Comment](s.getDB()).Where("id > ?", afterID).Order("id").Limit(limit).Find(context.Background())
}

func (s PostgresDB) IsBackfillDone(name string) (bool, error) {
	var count int64
	err := s.getDB().Model(&backfill{}).Where("name = ?", name).Count(&count).Error
	return count > 0, err
}

func (s PostgresDB) MarkBackfillDone(name string) error {
	row := backfill{Name: name, CompletedAt: time.Now().UTC().Format(time.RFC3339)}
	return s.getDB().Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
}
