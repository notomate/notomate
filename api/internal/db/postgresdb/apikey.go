package postgresdb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateAPIKey(k model.APIKey) error {
	return gorm.G[model.APIKey](s.db).Create(context.Background(), &k)
}

func (s PostgresDB) FindAPIKeys(f model.APIKeyFilter) ([]model.APIKey, error) {
	query := gorm.G[model.APIKey](s.getDB())

	var conds []string
	var args []interface{}

	if f.UserID != "" {
		conds = append(conds, "user_id = ?")
		args = append(args, f.UserID)
	}

	if f.Prefix != "" {
		conds = append(conds, "prefix = ?")
		args = append(args, f.Prefix)
	}

	if f.ID != "" {
		conds = append(conds, "id = ?")
		args = append(args, f.ID)
	}

	keys, err := query.
		Where(strings.Join(conds, " AND "), args...).
		Find(context.Background())

	return keys, err
}

func (s PostgresDB) FindAPIKeyByID(id string) (model.APIKey, error) {
	return gorm.
		G[model.APIKey](s.getDB()).
		Where("id = ?", id).
		Take(context.Background())
}

func (s PostgresDB) FindAPIKeyByPrefix(prefix string) (model.APIKey, error) {
	return gorm.
		G[model.APIKey](s.getDB()).
		Where("prefix = ?", prefix).
		Take(context.Background())
}

func (s PostgresDB) UpdateAPIKey(k model.APIKey) error {
	_, err := gorm.G[model.APIKey](s.getDB()).
		Where("id = ?", k.ID).
		Updates(context.Background(), k)

	return err
}

func (s PostgresDB) DeleteAPIKey(id string) error {
	_, err := gorm.G[model.APIKey](s.getDB()).
		Where("id = ?", id).
		Delete(context.Background())

	return err
}
