package model

type APIKeyFilter struct {
	UserID string
	ID     string
	Prefix string
}

type APIKey struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	Name       string `json:"name"`
	KeyHash    string `json:"-"` // Never expose hash in JSON
	Prefix     string `json:"prefix"`
	LastUsedAt string `json:"last_used_at"`
	ExpiresAt  string `json:"expires_at"`
	CreatedAt  string `json:"created_at"`
	CreatedBy  string `json:"created_by"`
	Scope      string `json:"scope"`
	GrantID    string `json:"-"` // Set on OAuth access tokens
}

// APIKeyResponse is what we return to clients (masked key)
type APIKeyResponse struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	Name       string `json:"name"`
	Prefix     string `json:"prefix"`
	LastUsedAt string `json:"last_used_at"`
	ExpiresAt  string `json:"expires_at"`
	CreatedAt  string `json:"created_at"`
	Scope      string `json:"scope"`
}

// APIKeyCreationResponse includes the full key (only returned once)
type APIKeyCreationResponse struct {
	APIKeyResponse
	FullKey string `json:"full_key"` // Only included on creation
}
