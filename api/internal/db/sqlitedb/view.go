package sqlitedb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s SqliteDB) CreateView(v model.View) error {
	return gorm.G[model.View](s.getDB()).Create(context.Background(), &v)
}

func (s SqliteDB) UpdateView(v model.View) error {
	_, err := gorm.G[model.View](s.getDB()).Where("id = ?", v.ID).Updates(context.Background(), v)
	return err
}

func (s SqliteDB) DeleteView(v model.View) error {
	_, err := gorm.G[model.View](s.getDB()).Where("id = ?", v.ID).Delete(context.Background())
	return err
}

func (s SqliteDB) FindView(v model.View) (model.View, error) {
	view, err := gorm.
		G[model.View](s.getDB()).
		Where("id = ?", v.ID).
		Take(context.Background())

	return view, err
}

func (s SqliteDB) FindViews(f model.ViewFilter) ([]model.View, error) {
	var views []model.View

	var conds []string
	var args []interface{}

	if f.WorkspaceID != "" {
		conds = append(conds, "workspace_id = ?")
		args = append(args, f.WorkspaceID)
	}

	if len(f.ViewIDs) > 0 {
		conds = append(conds, "id IN ?")
		args = append(args, f.ViewIDs)
	}

	if f.NoteID != "" {
		conds = append(conds, "note_id = ?")
		args = append(args, f.NoteID)
	}

	if f.ViewType != "" {
		conds = append(conds, "type = ?")
		args = append(args, f.ViewType)
	}

	query := s.getDB().Model(&model.View{})

	if len(conds) > 0 {
		query = query.Where(strings.Join(conds, " AND "), args...)
	}

	err := query.
		Order("created_at DESC").
		Offset((f.PageNumber - 1) * f.PageSize).
		Limit(f.PageSize).
		Find(&views).Error

	return views, err
}