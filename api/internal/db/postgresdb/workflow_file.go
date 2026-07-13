package postgresdb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateWorkflowFile(f model.WorkflowFile) error {
	return gorm.G[model.WorkflowFile](s.getDB()).Create(context.Background(), &f)
}

func (s PostgresDB) FindWorkflowFiles(workspaceID string) ([]model.WorkflowFile, error) {
	return gorm.
		G[model.WorkflowFile](s.getDB()).
		Where("workspace_id = ?", workspaceID).
		Order("path ASC").
		Find(context.Background())
}

func (s PostgresDB) FindWorkflowFileByID(f model.WorkflowFileFilter) (model.WorkflowFile, error) {
	return gorm.
		G[model.WorkflowFile](s.getDB()).
		Where("workspace_id = ? AND id = ?", f.WorkspaceID, f.ID).
		Take(context.Background())
}

func (s PostgresDB) FindWorkflowFileByPath(workspaceID, path string) (model.WorkflowFile, error) {
	return gorm.
		G[model.WorkflowFile](s.getDB()).
		Where("workspace_id = ? AND path = ?", workspaceID, path).
		Take(context.Background())
}

func (s PostgresDB) DeleteWorkflowFile(f model.WorkflowFileFilter) error {
	_, err := gorm.
		G[model.WorkflowFile](s.getDB()).
		Where("workspace_id = ? AND id = ?", f.WorkspaceID, f.ID).
		Delete(context.Background())

	return err
}
