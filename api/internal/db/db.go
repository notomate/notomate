package db

import (
	"context"

	"github.com/notomate/notomate/internal/model"
)

type DB interface {
	Uow
	UserRepository
	NoteRepository
	FileRepository
	WorkspaceRepository
	WorkspaceUserRepository
	ViewRepository
	ViewObjectRepository
	APIKeyRepository
	WorkflowRepository
	WorkflowRunRepository
	WorkflowVarRepository
	WorkflowSecretRepository
	RunnerRepository
	SettingRepository
}
type Uow interface {
	Begin(ctx context.Context) (DB, error)
	Commit() error
	Rollback() error
}
type UserRepository interface {
	CreateUser(u model.User) error
	FindUsers(f model.UserFilter) ([]model.User, error)
	FindUserByID(id string) (model.User, error)
	UpdateUser(u model.User) error
	UpdateUserWithDisabled(u model.User) error
	DeleteUser(id string) error
}
type NoteRepository interface {
	CreateNote(n model.Note) error
	UpdateNote(n model.Note) error
	DeleteNote(n model.Note) error
	FindNote(n model.Note) (model.Note, error)
	FindNotes(f model.NoteFilter) ([]model.Note, error)
	GetNoteCountsByDate(workspaceID string, startDate string, timezoneOffsetMinutes int) (map[string]int, error)
}
type FileRepository interface {
	CreateFile(u model.File) error
	FindFiles(f model.FileFilter) ([]model.File, error)
	FindFileByID(id string) (model.File, error)
	UpdateFile(f model.File) error
	DeleteFile(f model.FileFilter) error
}
type WorkspaceRepository interface {
	FindWorkspaces(f model.WorkspaceFilter) ([]model.Workspace, error)
	FindWorkspaceByID(id string) (model.Workspace, error)
	UpdateWorkspace(w model.Workspace) error
	CreateWorkspace(w model.Workspace) error
	DeleteWorkspace(id string) error
}
type WorkspaceUserRepository interface {
	FindWorkspaceUsers(f model.WorkspaceUserFilter) ([]model.WorkspaceUser, error)
	CreateWorkspaceUser(w model.WorkspaceUser) error
	UpdateWorkspaceUser(w model.WorkspaceUser) error
	DeleteWorkspaceUser(w model.WorkspaceUser) error
}
type ViewRepository interface {
	CreateView(v model.View) error
	UpdateView(v model.View) error
	DeleteView(v model.View) error
	FindView(v model.View) (model.View, error)
	FindViews(f model.ViewFilter) ([]model.View, error)
}
type ViewObjectRepository interface {
	CreateViewObject(v model.ViewObject) error
	UpdateViewObject(v model.ViewObject) error
	DeleteViewObject(v model.ViewObject) error
	FindViewObject(v model.ViewObject) (model.ViewObject, error)
	FindViewObjects(f model.ViewObjectFilter) ([]model.ViewObject, error)
}
type APIKeyRepository interface {
	CreateAPIKey(k model.APIKey) error
	FindAPIKeys(f model.APIKeyFilter) ([]model.APIKey, error)
	FindAPIKeyByID(id string) (model.APIKey, error)
	FindAPIKeyByPrefix(prefix string) (model.APIKey, error)
	UpdateAPIKey(k model.APIKey) error
	DeleteAPIKey(id string) error
}
type WorkflowRepository interface {
	CreateWorkflow(w model.Workflow) error
	FindWorkflow(w model.Workflow) (model.Workflow, error)
	FindWorkflows(f model.WorkflowFilter) ([]model.Workflow, error)
	UpdateWorkflow(w model.Workflow) error
	UpdateWorkflowEnabled(id string, enabled bool, updatedAt, updatedBy string) error
	DeleteWorkflow(id string) error
}
type WorkflowRunRepository interface {
	CreateWorkflowRun(r model.WorkflowRun) error
	FindWorkflowRun(r model.WorkflowRun) (model.WorkflowRun, error)
	FindWorkflowRuns(f model.WorkflowRunFilter) ([]model.WorkflowRun, error)
	UpdateWorkflowRunStatus(id string, status string, startedAt, finishedAt string) error
	NextWorkflowRunNumber(workflowID string) (int, error)
	DeleteWorkflowRunsBefore(createdBefore string) error

	CreateWorkflowJob(j model.WorkflowJob) error
	FindWorkflowJob(j model.WorkflowJob) (model.WorkflowJob, error)
	FindWorkflowJobs(f model.WorkflowJobFilter) ([]model.WorkflowJob, error)
	UpdateWorkflowJobStatus(id string, status string, startedAt, finishedAt string) error
	ClaimQueuedWorkflowJob(runnerID string, labels []string) (model.WorkflowJob, error)

	AppendWorkflowJobLogs(jobID string, startLine int, lines []string, createdAt string) error
	FindWorkflowJobLogs(jobID string, afterLine int, limit int) ([]model.WorkflowJobLog, error)
	CountWorkflowJobLogs(jobID string) (int, error)
}
type WorkflowVarRepository interface {
	CreateWorkflowVar(v model.WorkflowVar) error
	FindWorkflowVars(workspaceID string) ([]model.WorkflowVar, error)
	UpdateWorkflowVar(workspaceID, key, value, updatedAt, updatedBy string) error
	DeleteWorkflowVar(workspaceID, key string) error
}
type WorkflowSecretRepository interface {
	CreateWorkflowSecret(s model.WorkflowSecret) error
	FindWorkflowSecrets(workspaceID string) ([]model.WorkflowSecret, error)
	UpdateWorkflowSecret(workspaceID, key, valueEncrypted, updatedAt, updatedBy string) error
	DeleteWorkflowSecret(workspaceID, key string) error
}
type RunnerRepository interface {
	CreateRunner(r model.Runner) error
	FindRunners(f model.RunnerFilter) ([]model.Runner, error)
	FindRunnerByTokenHash(tokenHash string) (model.Runner, error)
	UpdateRunnerStatus(id string, status string, lastOnlineAt string) error
	DeleteRunner(id string) error
}
type SettingRepository interface {
	FindSetting(key string) (model.Setting, error)
	UpsertSetting(s model.Setting) error
}
