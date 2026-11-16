package mysqldb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s MySQLDB) CreateViewObject(v model.ViewObject) error {
	return gorm.G[model.ViewObject](s.getDB()).Create(context.Background(), &v)
}

func (s MySQLDB) UpdateViewObject(v model.ViewObject) error {
	_, err := gorm.G[model.ViewObject](s.getDB()).Where("id = ?", v.ID).Updates(context.Background(), v)
	return err
}

func (s MySQLDB) DeleteViewObject(v model.ViewObject) error {
	_, err := gorm.G[model.ViewObject](s.getDB()).Where("id = ?", v.ID).Delete(context.Background())
	return err
}

func (s MySQLDB) FindViewObject(v model.ViewObject) (model.ViewObject, error) {
	obj, err := gorm.
		G[model.ViewObject](s.getDB()).
		Where("id = ?", v.ID).
		Take(context.Background())

	return obj, err
}

func (s MySQLDB) FindViewObjects(f model.ViewObjectFilter) ([]model.ViewObject, error) {
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

	query = query.Order("created_at ASC")
	// PageSize <= 0 means "all objects" (the collab server loads a whole board).
	if f.PageSize > 0 {
		page := f.PageNumber
		if page < 1 {
			page = 1
		}
		query = query.Offset((page - 1) * f.PageSize).Limit(f.PageSize)
	}

	err := query.Find(&objects).Error

	return objects, err
}
