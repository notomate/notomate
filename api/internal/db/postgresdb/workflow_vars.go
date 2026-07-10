package postgresdb

import (
	"context"

	"github.com/collabreef/collabreef/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateWorkflowVar(v model.WorkflowVar) error {
	return gorm.G[model.WorkflowVar](s.getDB()).Create(context.Background(), &v)
}

func (s PostgresDB) FindWorkflowVars(workspaceID string) ([]model.WorkflowVar, error) {
	return gorm.G[model.WorkflowVar](s.getDB()).
		Where("workspace_id = ?", workspaceID).
		Order("key ASC").
		Find(context.Background())
}

func (s PostgresDB) UpdateWorkflowVar(workspaceID, key, value, updatedAt, updatedBy string) error {
	return s.getDB().
		Model(&model.WorkflowVar{}).
		Where("workspace_id = ? AND key = ?", workspaceID, key).
		Updates(map[string]interface{}{
			"value":      value,
			"updated_at": updatedAt,
			"updated_by": updatedBy,
		}).Error
}

func (s PostgresDB) DeleteWorkflowVar(workspaceID, key string) error {
	_, err := gorm.G[model.WorkflowVar](s.getDB()).
		Where("workspace_id = ? AND key = ?", workspaceID, key).
		Delete(context.Background())

	return err
}
