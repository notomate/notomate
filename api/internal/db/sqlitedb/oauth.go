package sqlitedb

import (
	"context"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s SqliteDB) CreateOAuthClient(c model.OAuthClient) error {
	return gorm.G[model.OAuthClient](s.getDB()).Create(context.Background(), &c)
}

func (s SqliteDB) FindOAuthClient(id string) (model.OAuthClient, error) {
	return gorm.G[model.OAuthClient](s.getDB()).Where("id = ?", id).Take(context.Background())
}

func (s SqliteDB) DeleteUnusedOAuthClients(createdBefore string) error {
	return s.getDB().Exec(
		"DELETE FROM oauth_clients WHERE created_at < ? AND id NOT IN (SELECT client_id FROM oauth_grants)",
		createdBefore,
	).Error
}

func (s SqliteDB) CreateOAuthCode(c model.OAuthCode) error {
	return gorm.G[model.OAuthCode](s.getDB()).Create(context.Background(), &c)
}

func (s SqliteDB) ConsumeOAuthCode(codeHash string) (model.OAuthCode, error) {
	code, err := gorm.G[model.OAuthCode](s.getDB()).Where("code_hash = ?", codeHash).Take(context.Background())
	if err != nil {
		return code, err
	}
	// Whoever deletes the row owns the code, so a replay can never redeem it twice.
	rows, err := gorm.G[model.OAuthCode](s.getDB()).Where("code_hash = ?", codeHash).Delete(context.Background())
	if err != nil {
		return code, err
	}
	if rows != 1 {
		return code, gorm.ErrRecordNotFound
	}
	return code, nil
}

func (s SqliteDB) DeleteExpiredOAuthData(now string) error {
	if _, err := gorm.G[model.OAuthCode](s.getDB()).Where("expires_at < ?", now).Delete(context.Background()); err != nil {
		return err
	}
	if _, err := gorm.G[model.APIKey](s.getDB()).Where("grant_id <> '' AND expires_at < ?", now).Delete(context.Background()); err != nil {
		return err
	}
	_, err := gorm.G[model.OAuthGrant](s.getDB()).Where("expires_at < ?", now).Delete(context.Background())
	return err
}

func (s SqliteDB) CreateOAuthGrant(g model.OAuthGrant) error {
	return gorm.G[model.OAuthGrant](s.getDB()).Create(context.Background(), &g)
}

func (s SqliteDB) FindOAuthGrantByID(id string) (model.OAuthGrant, error) {
	return gorm.G[model.OAuthGrant](s.getDB()).Where("id = ?", id).Take(context.Background())
}

func (s SqliteDB) FindOAuthGrantByRefreshHash(hash string) (model.OAuthGrant, error) {
	return gorm.G[model.OAuthGrant](s.getDB()).Where("refresh_hash = ?", hash).Take(context.Background())
}

func (s SqliteDB) FindOAuthGrantByPrevRefreshHash(hash string) (model.OAuthGrant, error) {
	return gorm.G[model.OAuthGrant](s.getDB()).Where("prev_refresh_hash = ?", hash).Take(context.Background())
}

func (s SqliteDB) FindOAuthGrantsByUser(userID string) ([]model.OAuthGrant, error) {
	return gorm.G[model.OAuthGrant](s.getDB()).Where("user_id = ?", userID).Find(context.Background())
}

func (s SqliteDB) RotateOAuthGrant(id, oldHash, newHash, lastUsedAt, expiresAt string) (bool, error) {
	rows, err := gorm.G[model.OAuthGrant](s.getDB()).
		Where("id = ? AND refresh_hash = ?", id, oldHash).
		Updates(context.Background(), model.OAuthGrant{
			RefreshHash:     newHash,
			PrevRefreshHash: oldHash,
			LastUsedAt:      lastUsedAt,
			ExpiresAt:       expiresAt,
		})
	return rows == 1, err
}

func (s SqliteDB) DeleteOAuthGrant(id string) error {
	if _, err := gorm.G[model.APIKey](s.getDB()).Where("grant_id = ?", id).Delete(context.Background()); err != nil {
		return err
	}
	_, err := gorm.G[model.OAuthGrant](s.getDB()).Where("id = ?", id).Delete(context.Background())
	return err
}
