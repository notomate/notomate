package model

type MessageFilter struct {
	WorkspaceID string
	ChannelID   string
}

type Message struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	ChannelID   string `json:"channel_id"`
	Body        string `json:"body"`
	Edited      bool   `json:"edited"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	UpdatedAt   string `json:"updated_at"`
	UpdatedBy   string `json:"updated_by"`
}
