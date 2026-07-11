package sqlitedb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s SqliteDB) CreateUser(u model.User) error {
	return gorm.G[model.User](s.db).Create(context.Background(), &u)
}

func (s SqliteDB) FindUsers(f model.UserFilter) ([]model.User, error) {
	query := gorm.
		G[model.User](s.getDB())

	var conds []string
	var args []interface{}

	if f.NameOrEmail != "" {
		conds = append(conds, "(name = ? OR email = ?)")
		args = append(args, f.NameOrEmail, f.NameOrEmail)
	}

	users, err := query.
		Where(strings.Join(conds, " AND "), args...).
		Find(context.Background())

	return users, err
}

func (s SqliteDB) FindUserByID(id string) (model.User, error) {
	return gorm.
		G[model.User](s.getDB()).
		Where("id = ?", id).
		Take(context.Background())
}

func (s SqliteDB) UpdateUser(u model.User) error {
	_, err := gorm.G[model.User](s.getDB()).Where("id = ?", u.ID).Updates(context.Background(), u)

	return err
}

func (s SqliteDB) UpdateUserWithDisabled(u model.User) error {
	// Use Select to force update all fields including zero values (like Disabled = false)
	_, err := gorm.G[model.User](s.getDB()).
		Where("id = ?", u.ID).
		Select("disabled", "updated_by", "updated_at").
		Updates(context.Background(), u)

	return err
}

func (s SqliteDB) DeleteUser(id string) error {
	_, err := gorm.G[model.User](s.getDB()).Where("id = ?", id).Delete(context.Background())

	return err
}
