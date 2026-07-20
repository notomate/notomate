package model

type WorkflowFilter struct {
	WorkspaceID string
	ID          string
	Enabled     *bool
	HasSchedule bool
	PageSize    int
	PageNumber  int
}

type Workflow struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	Name        string `json:"name"`
	Definition  string `json:"definition"`
	Enabled     bool   `json:"enabled"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	UpdatedAt   string `json:"updated_at"`
	UpdatedBy   string `json:"updated_by"`
}

const (
	WorkflowEventNoteCreated      = "note.created"
	WorkflowEventNoteUpdated      = "note.updated"
	WorkflowEventNoteDeleted      = "note.deleted"
	WorkflowEventCommentCreated   = "comment.created"
	WorkflowEventCommentUpdated   = "comment.updated"
	WorkflowEventCommentDeleted   = "comment.deleted"
	WorkflowEventSchedule         = "schedule"
	WorkflowEventWorkflowDispatch = "workflow_dispatch"
)

const (
	WorkflowRunStatusQueued    = "queued"
	WorkflowRunStatusRunning   = "running"
	WorkflowRunStatusSuccess   = "success"
	WorkflowRunStatusFailure   = "failure"
	WorkflowRunStatusCancelled = "cancelled"
)

// IsTerminalWorkflowRunStatus reports whether a run/job status is final.
func IsTerminalWorkflowRunStatus(status string) bool {
	switch status {
	case WorkflowRunStatusSuccess, WorkflowRunStatusFailure, WorkflowRunStatusCancelled:
		return true
	}
	return false
}

type WorkflowRunFilter struct {
	WorkspaceID string
	WorkflowID  string
	ID          string
	Status      string
	PageSize    int
	PageNumber  int
}

type WorkflowRun struct {
	ID           string `json:"id"`
	WorkflowID   string `json:"workflow_id"`
	WorkspaceID  string `json:"workspace_id"`
	RunNumber    int    `json:"run_number"`
	Event        string `json:"event"`
	EventPayload string `json:"event_payload"`
	Status       string `json:"status"`
	TriggeredBy  string `json:"triggered_by"`
	CreatedAt    string `json:"created_at"`
	StartedAt    string `json:"started_at"`
	FinishedAt   string `json:"finished_at"`
}

type WorkflowJobFilter struct {
	RunID  string
	ID     string
	Status string
}

type WorkflowJob struct {
	ID          string `json:"id"`
	RunID       string `json:"run_id"`
	WorkspaceID string `json:"workspace_id"`
	Name        string `json:"name"`
	RunsOn      string `json:"runs_on"` // JSON array of labels
	Status      string `json:"status"`
	RunnerID    string `json:"runner_id"`
	CreatedAt   string `json:"created_at"`
	StartedAt   string `json:"started_at"`
	FinishedAt  string `json:"finished_at"`
}

type WorkflowJobLog struct {
	JobID     string `json:"job_id"`
	LineNo    int    `json:"line_no"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at"`
}

type WorkflowVar struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	Key         string `json:"key"`
	Value       string `json:"value"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	UpdatedAt   string `json:"updated_at"`
	UpdatedBy   string `json:"updated_by"`
}

// WorkflowSecret never exposes its encrypted value over JSON; the API is
// write-only for secrets, like GitHub Actions.
type WorkflowSecret struct {
	ID             string `json:"id"`
	WorkspaceID    string `json:"workspace_id"`
	Key            string `json:"key"`
	ValueEncrypted string `json:"-"`
	CreatedAt      string `json:"created_at"`
	CreatedBy      string `json:"created_by"`
	UpdatedAt      string `json:"updated_at"`
	UpdatedBy      string `json:"updated_by"`
}
