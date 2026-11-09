package model

// API key scopes. An empty scope is an unrestricted key; the MCP scopes limit a
// key to the routes the MCP server calls (see middlewares.apiKeyScopeAllows).
const (
	ScopeMCPRead  = "mcp:read"
	ScopeMCPWrite = "mcp:write"
)

// OAuthClient is a dynamically registered public client (RFC 7591).
type OAuthClient struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	RedirectURIs string `json:"redirect_uris"` // JSON array
	CreatedAt    string `json:"created_at"`
}

func (OAuthClient) TableName() string { return "oauth_clients" }

// OAuthCode is a single-use authorization code, stored as a hash.
type OAuthCode struct {
	CodeHash      string `gorm:"primaryKey"`
	ClientID      string
	UserID        string
	RedirectURI   string
	CodeChallenge string
	Scope         string
	ExpiresAt     string
}

func (OAuthCode) TableName() string { return "oauth_codes" }

// OAuthGrant is one user's connection to a client. Its access tokens are rows in
// api_keys with GrantID set, so every service authenticates them like any API key.
type OAuthGrant struct {
	ID              string
	ClientID        string
	UserID          string
	Scope           string
	RefreshHash     string
	PrevRefreshHash string
	CreatedAt       string
	LastUsedAt      string
	ExpiresAt       string
}

func (OAuthGrant) TableName() string { return "oauth_grants" }

// OAuthGrantResponse is a connected application as shown to its user.
type OAuthGrantResponse struct {
	ID         string `json:"id"`
	ClientName string `json:"client_name"`
	Scope      string `json:"scope"`
	CreatedAt  string `json:"created_at"`
	LastUsedAt string `json:"last_used_at"`
}
