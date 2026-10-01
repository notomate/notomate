package sqlitedb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (s SqliteDB) FindWorkspaceIntegration(workspaceID, provider string) (model.WorkspaceIntegration, error) {
	return gorm.G[model.WorkspaceIntegration](s.getDB()).
		Where("workspace_id = ? AND provider = ?", workspaceID, provider).
		Take(context.Background())
}

func (s SqliteDB) UpsertWorkspaceIntegration(i model.WorkspaceIntegration) error {
	return s.getDB().
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "workspace_id"}, {Name: "provider"}},
			DoUpdates: clause.AssignmentColumns([]string{"config_encrypted", "updated_at", "updated_by"}),
		}).
		Create(&i).Error
}

func (s SqliteDB) DeleteWorkspaceIntegration(workspaceID, provider string) error {
	_, err := gorm.G[model.WorkspaceIntegration](s.getDB()).
		Where("workspace_id = ? AND provider = ?", workspaceID, provider).
		Delete(context.Background())
	return err
}

func (s SqliteDB) FindGoogleMapsCache(cacheKey, now string) (model.GoogleMapsCache, error) {
	return gorm.G[model.GoogleMapsCache](s.getDB()).
		Where("cache_key = ? AND expires_at > ?", cacheKey, now).
		Take(context.Background())
}

func (s SqliteDB) UpsertGoogleMapsCache(c model.GoogleMapsCache) error {
	return s.getDB().
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "cache_key"}},
			DoUpdates: clause.AssignmentColumns([]string{"response", "content_type", "ref", "created_at", "expires_at"}),
		}).
		Create(&c).Error
}

func (s SqliteDB) HasGoogleMapsCacheRef(workspaceID, kind, ref string) (bool, error) {
	var count int64
	err := s.getDB().Model(&model.GoogleMapsCache{}).
		Where("workspace_id = ? AND kind = ? AND ref = ?", workspaceID, kind, ref).
		Count(&count).Error
	return count > 0, err
}

func (s SqliteDB) FindGoogleMapsCacheEntries(f model.GoogleMapsCacheFilter) ([]model.GoogleMapsCache, error) {
	q := gorm.G[model.GoogleMapsCache](s.getDB()).Where("1 = 1")
	if f.WorkspaceID != "" {
		q = q.Where("workspace_id = ?", f.WorkspaceID)
	}
	if f.Kind != "" {
		q = q.Where("kind = ?", f.Kind)
	}
	if f.ExpiresBefore != "" {
		q = q.Where("expires_at <= ?", f.ExpiresBefore)
	}
	if f.Limit > 0 {
		q = q.Limit(f.Limit)
	}
	return q.Find(context.Background())
}

func (s SqliteDB) DeleteGoogleMapsCacheEntries(f model.GoogleMapsCacheFilter) error {
	q := s.getDB().Where("1 = 1")
	if f.WorkspaceID != "" {
		q = q.Where("workspace_id = ?", f.WorkspaceID)
	}
	if f.Kind != "" {
		q = q.Where("kind = ?", f.Kind)
	}
	if f.ExpiresBefore != "" {
		q = q.Where("expires_at <= ?", f.ExpiresBefore)
	}
	return q.Delete(&model.GoogleMapsCache{}).Error
}
