package sqlitedb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s SqliteDB) CreateChannel(c model.Channel) error {
	return gorm.G[model.Channel](s.getDB()).Create(context.Background(), &c)
}

func (s SqliteDB) UpdateChannel(c model.Channel) error {
	_, err := gorm.G[model.Channel](s.getDB()).
		Where("id = ?", c.ID).
		Select("name", "description", "updated_at", "updated_by").
		Updates(context.Background(), c)
	return err
}

func (s SqliteDB) DeleteChannel(c model.Channel) error {
	_, err := gorm.G[model.Channel](s.getDB()).Where("id = ?", c.ID).Delete(context.Background())
	return err
}

func (s SqliteDB) FindChannel(c model.Channel) (model.Channel, error) {
	channel, err := gorm.
		G[model.Channel](s.getDB()).
		Where("id = ?", c.ID).
		Take(context.Background())

	return channel, err
}

func (s SqliteDB) FindChannels(f model.ChannelFilter) ([]model.Channel, error) {
	var channels []model.Channel

	query := s.getDB().Model(&model.Channel{})

	if f.WorkspaceID != "" {
		query = query.Where("workspace_id = ?", f.WorkspaceID)
	}

	err := query.Order("created_at ASC").Find(&channels).Error

	return channels, err
}
