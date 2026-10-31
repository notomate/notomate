package mysqldb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s MySQLDB) CreateComment(c model.Comment) error {
	return gorm.G[model.Comment](s.getDB()).Create(context.Background(), &c)
}

func (s MySQLDB) UpdateComment(c model.Comment) error {
	_, err := gorm.G[model.Comment](s.getDB()).
		Where("id = ?", c.ID).
		Select("body", "edited", "updated_at", "updated_by").
		Updates(context.Background(), c)
	return err
}

func (s MySQLDB) DeleteComment(c model.Comment) error {
	_, err := gorm.G[model.Comment](s.getDB()).Where("id = ?", c.ID).Delete(context.Background())
	return err
}

func (s MySQLDB) FindComment(c model.Comment) (model.Comment, error) {
	comment, err := gorm.
		G[model.Comment](s.getDB()).
		Where("id = ?", c.ID).
		Take(context.Background())

	return comment, err
}

func (s MySQLDB) FindComments(f model.CommentFilter) ([]model.Comment, error) {
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
