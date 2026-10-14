package model

const (
	ActionSourceStatusPending = "pending"
	ActionSourceStatusOK      = "ok"
	ActionSourceStatusError   = "error"
)

// ActionSource is a GitHub repository a workspace pulls actions from. Every
// action.yml/action.yaml found in the repository tree becomes a
// MarketplaceAction. An empty Ref means the repository's default branch,
// which is recorded in ResolvedRef on each sync.
type ActionSource struct {
	ID           string `json:"id"`
	WorkspaceID  string `json:"workspace_id"`
	Owner        string `json:"owner"`
	Repo         string `json:"repo"`
	Ref          string `json:"ref"`
	ResolvedRef  string `json:"resolved_ref"`
	ResolvedSHA  string `json:"resolved_sha" gorm:"column:resolved_sha"`
	Status       string `json:"status"`
	LastError    string `json:"last_error"`
	LastSyncedAt string `json:"last_synced_at"`
	CreatedAt    string `json:"created_at"`
	CreatedBy    string `json:"created_by"`
	UpdatedAt    string `json:"updated_at"`
	UpdatedBy    string `json:"updated_by"`
}

// MarketplaceAction is the metadata of one action.yml found in an
// ActionSource. Uses is the value to put in a step's `uses:`.
type MarketplaceAction struct {
	ID          string         `json:"id"`
	SourceID    string         `json:"source_id"`
	WorkspaceID string         `json:"workspace_id"`
	Path        string         `json:"path"`
	Uses        string         `json:"uses"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Author      string         `json:"author"`
	Icon        string         `json:"icon"`
	Color       string         `json:"color"`
	RunsUsing   string         `json:"runs_using"`
	Inputs      []ActionInput  `json:"inputs" gorm:"serializer:json"`
	Outputs     []ActionOutput `json:"outputs" gorm:"serializer:json"`
	CreatedAt   string         `json:"created_at"`
}

type ActionInput struct {
	Name               string `json:"name"`
	Description        string `json:"description,omitempty"`
	Required           bool   `json:"required"`
	Default            string `json:"default,omitempty"`
	DeprecationMessage string `json:"deprecation_message,omitempty"`
}

type ActionOutput struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}
