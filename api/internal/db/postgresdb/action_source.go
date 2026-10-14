package postgresdb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateActionSource(src model.ActionSource) error {
	return gorm.G[model.ActionSource](s.getDB()).Create(context.Background(), &src)
}

func (s PostgresDB) FindActionSource(workspaceID, id string) (model.ActionSource, error) {
	return gorm.G[model.ActionSource](s.getDB()).
		Where("workspace_id = ? AND id = ?", workspaceID, id).
		Take(context.Background())
}

func (s PostgresDB) FindActionSources(workspaceID string) ([]model.ActionSource, error) {
	return gorm.G[model.ActionSource](s.getDB()).
		Where("workspace_id = ?", workspaceID).
		Order("owner ASC, repo ASC, ref ASC").
		Find(context.Background())
}

func (s PostgresDB) UpdateActionSourceSync(src model.ActionSource) error {
	return s.getDB().
		Model(&model.ActionSource{}).
		Where("workspace_id = ? AND id = ?", src.WorkspaceID, src.ID).
		Updates(map[string]interface{}{
			"resolved_ref":   src.ResolvedRef,
			"resolved_sha":   src.ResolvedSHA,
			"status":         src.Status,
			"last_error":     src.LastError,
			"last_synced_at": src.LastSyncedAt,
			"updated_at":     src.UpdatedAt,
			"updated_by":     src.UpdatedBy,
		}).Error
}

func (s PostgresDB) DeleteActionSource(workspaceID, id string) error {
	return s.getDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("workspace_id = ? AND source_id = ?", workspaceID, id).Delete(&model.MarketplaceAction{}).Error; err != nil {
			return err
		}
		return tx.Where("workspace_id = ? AND id = ?", workspaceID, id).Delete(&model.ActionSource{}).Error
	})
}

func (s PostgresDB) ReplaceSourceActions(sourceID string, actions []model.MarketplaceAction) error {
	return s.getDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("source_id = ?", sourceID).Delete(&model.MarketplaceAction{}).Error; err != nil {
			return err
		}
		if len(actions) == 0 {
			return nil
		}
		return tx.CreateInBatches(actions, 100).Error
	})
}

func (s PostgresDB) FindMarketplaceActions(workspaceID string) ([]model.MarketplaceAction, error) {
	return gorm.G[model.MarketplaceAction](s.getDB()).
		Where("workspace_id = ?", workspaceID).
		Order("source_id ASC, path ASC").
		Find(context.Background())
}
