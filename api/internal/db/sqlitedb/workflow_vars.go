package sqlitedb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s SqliteDB) CreateWorkflowVar(v model.WorkflowVar) error {
	return gorm.G[model.WorkflowVar](s.getDB()).Create(context.Background(), &v)
}

func (s SqliteDB) FindWorkflowVars(workspaceID string) ([]model.WorkflowVar, error) {
	return gorm.G[model.WorkflowVar](s.getDB()).
		Where("workspace_id = ?", workspaceID).
		Order("key ASC").
		Find(context.Background())
}

func (s SqliteDB) UpdateWorkflowVar(workspaceID, key, value, updatedAt, updatedBy string) error {
	return s.getDB().
		Model(&model.WorkflowVar{}).
		Where("workspace_id = ? AND key = ?", workspaceID, key).
		Updates(map[string]interface{}{
			"value":      value,
			"updated_at": updatedAt,
			"updated_by": updatedBy,
		}).Error
}

func (s SqliteDB) DeleteWorkflowVar(workspaceID, key string) error {
	_, err := gorm.G[model.WorkflowVar](s.getDB()).
		Where("workspace_id = ? AND key = ?", workspaceID, key).
		Delete(context.Background())

	return err
}
