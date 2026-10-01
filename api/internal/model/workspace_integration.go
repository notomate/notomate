package model

const WorkspaceIntegrationProviderGoogleMaps = "google_maps"

// WorkspaceIntegration holds third-party credentials for a workspace. The
// config is an encrypted JSON blob and is never exposed over JSON.
type WorkspaceIntegration struct {
	ID              string `json:"id"`
	WorkspaceID     string `json:"workspace_id"`
	Provider        string `json:"provider"`
	ConfigEncrypted string `json:"-"`
	CreatedAt       string `json:"created_at"`
	CreatedBy       string `json:"created_by"`
	UpdatedAt       string `json:"updated_at"`
	UpdatedBy       string `json:"updated_by"`
}

// GoogleMapsCache stores Google Maps API responses per workspace. For photos,
// Response holds the storage file name of the cached image rather than the
// image itself. Ref is the place ID for details and photo entries, so photo
// requests can be checked against places this workspace has looked up.
type GoogleMapsCache struct {
	CacheKey    string `gorm:"primaryKey"`
	WorkspaceID string
	Kind        string
	Ref         string
	Response    string
	ContentType string
	CreatedAt   string
	ExpiresAt   string
}

func (GoogleMapsCache) TableName() string {
	return "google_maps_cache"
}

type GoogleMapsCacheFilter struct {
	WorkspaceID   string
	Kind          string
	ExpiresBefore string
	Limit         int
}
