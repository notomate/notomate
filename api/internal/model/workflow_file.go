package model

type WorkflowFileFilter struct {
	WorkspaceID string
	ID          string
}

// WorkflowFile is a codebase file shared by every workflow in a workspace,
// the same way WorkflowVar/WorkflowSecret are workspace-scoped rather than
// tied to one workflow.
type WorkflowFile struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	Path        string `json:"path"`
	StorageKey  string `json:"-"`
	Size        int64  `json:"size"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	UpdatedAt   string `json:"updated_at"`
	UpdatedBy   string `json:"updated_by"`
}
