package sqlitedb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (s SqliteDB) CreateRunner(r model.Runner) error {
	return gorm.G[model.Runner](s.getDB()).Create(context.Background(), &r)
}

func (s SqliteDB) FindRunners(f model.RunnerFilter) ([]model.Runner, error) {
	query := gorm.G[model.Runner](s.getDB())

	var conds []string
	var args []interface{}

	if f.ID != "" {
		conds = append(conds, "id = ?")
		args = append(args, f.ID)
	}

	return query.
		Where(strings.Join(conds, " AND "), args...).
		Order("created_at ASC").
		Find(context.Background())
}

func (s SqliteDB) FindRunnerByTokenHash(tokenHash string) (model.Runner, error) {
	return gorm.G[model.Runner](s.getDB()).
		Where("token_hash = ?", tokenHash).
		Take(context.Background())
}

func (s SqliteDB) UpdateRunnerStatus(id string, status string, lastOnlineAt string) error {
	updates := map[string]interface{}{"status": status}
	if lastOnlineAt != "" {
		updates["last_online_at"] = lastOnlineAt
	}
	return s.getDB().
		Model(&model.Runner{}).
		Where("id = ?", id).
		Updates(updates).Error
}

func (s SqliteDB) DeleteRunner(id string) error {
	_, err := gorm.G[model.Runner](s.getDB()).
		Where("id = ?", id).
		Delete(context.Background())

	return err
}

func (s SqliteDB) FindSetting(key string) (model.Setting, error) {
	return gorm.G[model.Setting](s.getDB()).
		Where("key = ?", key).
		Take(context.Background())
}

func (s SqliteDB) UpsertSetting(setting model.Setting) error {
	return s.getDB().
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}},
			DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
		}).
		Create(&setting).Error
}
