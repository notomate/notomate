package sqlitedb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s SqliteDB) CreateMessage(m model.Message) error {
	return gorm.G[model.Message](s.getDB()).Create(context.Background(), &m)
}

func (s SqliteDB) UpdateMessage(m model.Message) error {
	_, err := gorm.G[model.Message](s.getDB()).
		Where("id = ?", m.ID).
		Select("body", "edited", "updated_at", "updated_by").
		Updates(context.Background(), m)
	return err
}

func (s SqliteDB) DeleteMessage(m model.Message) error {
	_, err := gorm.G[model.Message](s.getDB()).Where("id = ?", m.ID).Delete(context.Background())
	return err
}

func (s SqliteDB) FindMessage(m model.Message) (model.Message, error) {
	message, err := gorm.
		G[model.Message](s.getDB()).
		Where("id = ?", m.ID).
		Take(context.Background())

	return message, err
}

func (s SqliteDB) FindMessages(f model.MessageFilter) ([]model.Message, error) {
	var messages []model.Message

	query := s.getDB().Model(&model.Message{})

	if f.WorkspaceID != "" {
		query = query.Where("workspace_id = ?", f.WorkspaceID)
	}

	if f.ChannelID != "" {
		query = query.Where("channel_id = ?", f.ChannelID)
	}

	err := query.Order("created_at ASC").Find(&messages).Error

	return messages, err
}
