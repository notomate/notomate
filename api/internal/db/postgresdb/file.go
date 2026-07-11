package postgresdb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateFile(u model.File) error {
	return gorm.G[model.File](s.getDB()).Create(context.Background(), &u)
}

func (s PostgresDB) FindFiles(f model.FileFilter) ([]model.File, error) {
	var conds []string
	var args []interface{}

	if f.WorkspaceID != "" {
		conds = append(conds, "workspace_id = ?")
		args = append(args, f.WorkspaceID)
	}

	if f.ID != "" {
		conds = append(conds, "id = ?")
		args = append(args, f.ID)
	}

	if len(f.Exts) > 0 {
		conds = append(conds, "ext IN ?")
		args = append(args, f.Exts)
	}

	if f.Query != "" {
		conds = append(conds, "original_filename LIKE ?")
		args = append(args, "%"+f.Query+"%")
	}

	whereClause := strings.Join(conds, " AND ")
	if whereClause == "" {
		whereClause = "1 = 1"
	}

	query := gorm.
		G[model.File](s.getDB()).
		Where(whereClause, args...).
		Order("created_at DESC")

	if f.PageSize > 0 && f.PageNumber > 0 {
		query = query.Offset((f.PageNumber - 1) * f.PageSize).Limit(f.PageSize)
	}

	Files, err := query.Find(context.Background())

	return Files, err
}

func (s PostgresDB) FindFileByID(id string) (model.File, error) {
	return gorm.
		G[model.File](s.getDB()).
		Where("id = ?", id).
		Take(context.Background())
}

func (s PostgresDB) UpdateFile(f model.File) error {
	_, err := gorm.G[model.File](s.getDB()).Where("id = ?", f.ID).Updates(context.Background(), f)

	return err
}

func (s PostgresDB) DeleteFile(f model.FileFilter) error {
	_, err := gorm.G[model.File](s.getDB()).Where("workspace_id = ? AND id = ?", f.WorkspaceID, f.ID).Delete(context.Background())

	return err
}
