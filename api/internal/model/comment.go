package model

type CommentFilter struct {
	WorkspaceID string
	NoteID      string
}

type Comment struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	NoteID      string `json:"note_id"`
	ThreadID    string `json:"thread_id"`
	QuotedText  string `json:"quoted_text"`
	Body        string `json:"body"`
	Edited      bool   `json:"edited"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	UpdatedAt   string `json:"updated_at"`
	UpdatedBy   string `json:"updated_by"`
}
