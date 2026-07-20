package postgresdb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateComment(c model.Comment) error {
	return gorm.G[model.Comment](s.getDB()).Create(context.Background(), &c)
}

func (s PostgresDB) UpdateComment(c model.Comment) error {
	_, err := gorm.G[model.Comment](s.getDB()).
		Where("id = ?", c.ID).
		Select("body", "edited", "updated_at", "updated_by").
		Updates(context.Background(), c)
	return err
}

func (s PostgresDB) DeleteComment(c model.Comment) error {
	_, err := gorm.G[model.Comment](s.getDB()).Where("id = ?", c.ID).Delete(context.Background())
	return err
}

func (s PostgresDB) FindComment(c model.Comment) (model.Comment, error) {
	comment, err := gorm.
		G[model.Comment](s.getDB()).
		Where("id = ?", c.ID).
		Take(context.Background())

	return comment, err
}

func (s PostgresDB) FindComments(f model.CommentFilter) ([]model.Comment, error) {
	var comments []model.Comment

	query := s.getDB().Model(&model.Comment{})

	if f.WorkspaceID != "" {
		query = query.Where("workspace_id = ?", f.WorkspaceID)
	}

	if f.NoteID != "" {
		query = query.Where("note_id = ?", f.NoteID)
	}

	err := query.Order("created_at ASC").Find(&comments).Error

	return comments, err
}
