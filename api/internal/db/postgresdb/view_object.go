package postgresdb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateViewObject(v model.ViewObject) error {
	return gorm.G[model.ViewObject](s.getDB()).Create(context.Background(), &v)
}

func (s PostgresDB) UpdateViewObject(v model.ViewObject) error {
	_, err := gorm.G[model.ViewObject](s.getDB()).Where("id = ?", v.ID).Updates(context.Background(), v)
	return err
}

func (s PostgresDB) DeleteViewObject(v model.ViewObject) error {
	_, err := gorm.G[model.ViewObject](s.getDB()).Where("id = ?", v.ID).Delete(context.Background())
	return err
}

func (s PostgresDB) FindViewObject(v model.ViewObject) (model.ViewObject, error) {
	obj, err := gorm.
		G[model.ViewObject](s.getDB()).
		Where("id = ?", v.ID).
		Take(context.Background())

	return obj, err
}

func (s PostgresDB) FindViewObjects(f model.ViewObjectFilter) ([]model.ViewObject, error) {
	var objects []model.ViewObject

	var conds []string
	var args []interface{}

	if f.ViewID != "" {
		conds = append(conds, "view_id = ?")
		args = append(args, f.ViewID)
	}

	if len(f.ObjectIDs) > 0 {
		conds = append(conds, "id IN ?")
		args = append(args, f.ObjectIDs)
	}

	if f.ObjectType != "" {
		conds = append(conds, "type = ?")
		args = append(args, f.ObjectType)
	}

	query := s.getDB().Model(&model.ViewObject{})

	if len(conds) > 0 {
		query = query.Where(strings.Join(conds, " AND "), args...)
	}

	err := query.
		Order("created_at ASC").
		Offset((f.PageNumber - 1) * f.PageSize).
		Limit(f.PageSize).
		Find(&objects).Error

	return objects, err
}
