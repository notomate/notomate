package postgresdb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) FindWorkspaces(f model.WorkspaceFilter) ([]model.Workspace, error) {
	query := gorm.
		G[model.Workspace](s.db)

	var conds []string
	var args []interface{}

	if f.WorkspaceIDs != nil {
		conds = append(conds, "id IN ?")
		args = append(args, f.WorkspaceIDs)
	}

	workspaces, err := query.
		Where(strings.Join(conds, " AND "), args...).
		Find(context.Background())

	return workspaces, err
}

func (s PostgresDB) FindWorkspaceByID(id string) (model.Workspace, error) {
	return gorm.
		G[model.Workspace](s.getDB()).
		Where("id = ?", id).
		Take(context.Background())
}

func (s PostgresDB) UpdateWorkspace(w model.Workspace) error {
	_, err := gorm.G[model.Workspace](s.getDB()).Where("id = ?", w.ID).Updates(context.Background(), w)

	return err
}

func (s PostgresDB) CreateWorkspace(w model.Workspace) error {
	return gorm.G[model.Workspace](s.getDB()).Create(context.Background(), &w)
}

func (s PostgresDB) DeleteWorkspace(id string) error {
	_, err := gorm.G[model.Workspace](s.getDB()).Where("id = ?", id).Delete(context.Background())

	return err
}
