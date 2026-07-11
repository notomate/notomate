package postgresdb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateWorkflowSecret(v model.WorkflowSecret) error {
	return gorm.G[model.WorkflowSecret](s.getDB()).Create(context.Background(), &v)
}

func (s PostgresDB) FindWorkflowSecrets(workspaceID string) ([]model.WorkflowSecret, error) {
	return gorm.G[model.WorkflowSecret](s.getDB()).
		Where("workspace_id = ?", workspaceID).
		Order("key ASC").
		Find(context.Background())
}

func (s PostgresDB) UpdateWorkflowSecret(workspaceID, key, valueEncrypted, updatedAt, updatedBy string) error {
	return s.getDB().
		Model(&model.WorkflowSecret{}).
		Where("workspace_id = ? AND key = ?", workspaceID, key).
		Updates(map[string]interface{}{
			"value_encrypted": valueEncrypted,
			"updated_at":      updatedAt,
			"updated_by":      updatedBy,
		}).Error
}

func (s PostgresDB) DeleteWorkflowSecret(workspaceID, key string) error {
	_, err := gorm.G[model.WorkflowSecret](s.getDB()).
		Where("workspace_id = ? AND key = ?", workspaceID, key).
		Delete(context.Background())

	return err
}
