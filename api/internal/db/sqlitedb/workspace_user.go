package sqlitedb

import (
	"context"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s SqliteDB) FindWorkspaceUsers(f model.WorkspaceUserFilter) ([]model.WorkspaceUser, error) {
	query := gorm.
		G[model.WorkspaceUser](s.getDB())

	var conds []string
	var args []interface{}

	if f.UserID != "" {
		conds = append(conds, "user_id = ?")
		args = append(args, f.UserID)
	}

	if f.WorkspaceID != "" {
		conds = append(conds, "workspace_id = ?")
		args = append(args, f.WorkspaceID)
	}

	users, err := query.
		Where(strings.Join(conds, " AND "), args...).
		Find(context.Background())

	return users, err
}
func (s SqliteDB) CreateWorkspaceUser(w model.WorkspaceUser) error {
	return gorm.G[model.WorkspaceUser](s.getDB()).Create(context.Background(), &w)
}
func (s SqliteDB) UpdateWorkspaceUser(w model.WorkspaceUser) error {
	_, err := gorm.G[model.WorkspaceUser](s.getDB()).
		Where("workspace_id = ? AND user_id = ?", w.WorkspaceID, w.UserID).
		Updates(context.Background(), w)
	return err
}
func (s SqliteDB) DeleteWorkspaceUser(w model.WorkspaceUser) error {
	_, err := gorm.G[model.WorkspaceUser](s.getDB()).Where("workspace_id = ? AND user_id = ?", w.WorkspaceID, w.UserID).Delete(context.Background())

	return err
}
