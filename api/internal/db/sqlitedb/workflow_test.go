package sqlitedb

import (
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratesqlite3 "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/model"
)

func newTestDB(t *testing.T) *SqliteDB {
	t.Helper()

	dsn := filepath.Join(t.TempDir(), "test.db")

	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	driver, err := migratesqlite3.WithInstance(sqlDB, &migratesqlite3.Config{})
	if err != nil {
		t.Fatalf("migrate driver: %v", err)
	}
	m, err := migrate.NewWithDatabaseInstance("file://../../../migrations/sqlite3", "main", driver)
	if err != nil {
		t.Fatalf("migrate instance: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("apply migrations: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close migration connection: %v", err)
	}

	gdb, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open gorm: %v", err)
	}
	t.Cleanup(func() {
		if conn, err := gdb.DB(); err == nil {
			conn.Close()
		}
	})
	return &SqliteDB{db: gdb}
}

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func TestWorkflowRepositoryRoundTrip(t *testing.T) {
	s := newTestDB(t)

	if err := s.CreateWorkspace(model.Workspace{ID: "ws1", Name: "ws", CreatedAt: now()}); err != nil {
		t.Fatalf("create workspace: %v", err)
	}

	wf := model.Workflow{
		ID:          "wf1",
		WorkspaceID: "ws1",
		Name:        "test workflow",
		Definition:  "name: test",
		Enabled:     true,
		CreatedAt:   now(),
		CreatedBy:   "u1",
	}
	if err := s.CreateWorkflow(wf); err != nil {
		t.Fatalf("create workflow: %v", err)
	}

	got, err := s.FindWorkflow(model.Workflow{ID: "wf1"})
	if err != nil {
		t.Fatalf("find workflow: %v", err)
	}
	if got.Name != "test workflow" || !got.Enabled {
		t.Fatalf("unexpected workflow: %+v", got)
	}

	got.Name = "renamed"
	got.Definition = "name: renamed"
	got.UpdatedAt = now()
	got.UpdatedBy = "u1"
	if err := s.UpdateWorkflow(got); err != nil {
		t.Fatalf("update workflow: %v", err)
	}

	if err := s.UpdateWorkflowEnabled("wf1", false, now(), "u1"); err != nil {
		t.Fatalf("update enabled: %v", err)
	}
	got, err = s.FindWorkflow(model.Workflow{ID: "wf1"})
	if err != nil {
		t.Fatalf("re-find workflow: %v", err)
	}
	if got.Name != "renamed" || got.Enabled {
		t.Fatalf("update not applied: %+v", got)
	}

	enabled := false
	list, err := s.FindWorkflows(model.WorkflowFilter{WorkspaceID: "ws1", Enabled: &enabled})
	if err != nil || len(list) != 1 {
		t.Fatalf("find workflows: %v %d", err, len(list))
	}

	if err := s.DeleteWorkflow("wf1"); err != nil {
		t.Fatalf("delete workflow: %v", err)
	}
	if _, err := s.FindWorkflow(model.Workflow{ID: "wf1"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected not found after delete, got %v", err)
	}
}

func TestWorkflowRunsJobsAndLogs(t *testing.T) {
	s := newTestDB(t)

	if err := s.CreateWorkspace(model.Workspace{ID: "ws1", Name: "ws", CreatedAt: now()}); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	if err := s.CreateWorkflow(model.Workflow{ID: "wf1", WorkspaceID: "ws1", Name: "wf", Definition: "x", Enabled: true, CreatedAt: now()}); err != nil {
		t.Fatalf("create workflow: %v", err)
	}

	n, err := s.NextWorkflowRunNumber("wf1")
	if err != nil || n != 1 {
		t.Fatalf("next run number: %v %d", err, n)
	}

	run := model.WorkflowRun{
		ID: "run1", WorkflowID: "wf1", WorkspaceID: "ws1", RunNumber: n,
		Event: model.WorkflowEventWorkflowDispatch, EventPayload: "{}",
		Status: model.WorkflowRunStatusQueued, TriggeredBy: "u1", CreatedAt: now(),
	}
	if err := s.CreateWorkflowRun(run); err != nil {
		t.Fatalf("create run: %v", err)
	}
	if n, _ := s.NextWorkflowRunNumber("wf1"); n != 2 {
		t.Fatalf("expected next run number 2, got %d", n)
	}

	job := model.WorkflowJob{
		ID: "job1", RunID: "run1", WorkspaceID: "ws1", Name: "build",
		RunsOn: `["ubuntu-latest"]`, Status: model.WorkflowRunStatusQueued, CreatedAt: now(),
	}
	if err := s.CreateWorkflowJob(job); err != nil {
		t.Fatalf("create job: %v", err)
	}

	// Claim with non-matching labels finds nothing.
	if _, err := s.ClaimQueuedWorkflowJob("runner1", []string{"windows"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected no claim for wrong labels, got %v", err)
	}

	claimed, err := s.ClaimQueuedWorkflowJob("runner1", []string{"ubuntu-latest", "docker"})
	if err != nil {
		t.Fatalf("claim job: %v", err)
	}
	if claimed.ID != "job1" || claimed.Status != model.WorkflowRunStatusRunning || claimed.RunnerID != "runner1" {
		t.Fatalf("unexpected claim result: %+v", claimed)
	}

	// A second claim must not return the same job.
	if _, err := s.ClaimQueuedWorkflowJob("runner2", []string{"ubuntu-latest"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected no second claim, got %v", err)
	}

	if err := s.AppendWorkflowJobLogs("job1", 1, []string{"line one", "line two"}, now()); err != nil {
		t.Fatalf("append logs: %v", err)
	}
	if err := s.AppendWorkflowJobLogs("job1", 3, []string{"line three"}, now()); err != nil {
		t.Fatalf("append more logs: %v", err)
	}
	logs, err := s.FindWorkflowJobLogs("job1", 1, 10)
	if err != nil || len(logs) != 2 {
		t.Fatalf("find logs after line 1: %v %d", err, len(logs))
	}
	if logs[0].LineNo != 2 || logs[1].Content != "line three" {
		t.Fatalf("unexpected logs: %+v", logs)
	}
	if count, _ := s.CountWorkflowJobLogs("job1"); count != 3 {
		t.Fatalf("expected 3 log lines, got %d", count)
	}

	if err := s.UpdateWorkflowJobStatus("job1", model.WorkflowRunStatusSuccess, "", now()); err != nil {
		t.Fatalf("update job status: %v", err)
	}
	if err := s.UpdateWorkflowRunStatus("run1", model.WorkflowRunStatusSuccess, now(), now()); err != nil {
		t.Fatalf("update run status: %v", err)
	}

	// Retention prune removes terminal runs (and their jobs/logs) older than the cutoff.
	cutoff := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	if err := s.DeleteWorkflowRunsBefore(cutoff); err != nil {
		t.Fatalf("prune runs: %v", err)
	}
	if _, err := s.FindWorkflowRun(model.WorkflowRun{ID: "run1"}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected run pruned, got %v", err)
	}
	if jobs, _ := s.FindWorkflowJobs(model.WorkflowJobFilter{RunID: "run1"}); len(jobs) != 0 {
		t.Fatalf("expected jobs pruned, got %d", len(jobs))
	}
	if count, _ := s.CountWorkflowJobLogs("job1"); count != 0 {
		t.Fatalf("expected logs pruned, got %d", count)
	}
}

func TestRunnerAndSettingRepository(t *testing.T) {
	s := newTestDB(t)

	r := model.Runner{
		ID: "r1", Name: "default", Labels: `["ubuntu-latest"]`,
		TokenHash: "hash1", Status: model.RunnerStatusOffline, CreatedAt: now(),
	}
	if err := s.CreateRunner(r); err != nil {
		t.Fatalf("create runner: %v", err)
	}

	got, err := s.FindRunnerByTokenHash("hash1")
	if err != nil || got.ID != "r1" {
		t.Fatalf("find by token hash: %v %+v", err, got)
	}

	if err := s.UpdateRunnerStatus("r1", model.RunnerStatusOnline, now()); err != nil {
		t.Fatalf("update runner status: %v", err)
	}
	runners, err := s.FindRunners(model.RunnerFilter{})
	if err != nil || len(runners) != 1 || runners[0].Status != model.RunnerStatusOnline {
		t.Fatalf("find runners: %v %+v", err, runners)
	}

	if err := s.DeleteRunner("r1"); err != nil {
		t.Fatalf("delete runner: %v", err)
	}

	if err := s.UpsertSetting(model.Setting{Key: "k", Value: "v1", UpdatedAt: now()}); err != nil {
		t.Fatalf("upsert setting: %v", err)
	}
	if err := s.UpsertSetting(model.Setting{Key: "k", Value: "v2", UpdatedAt: now()}); err != nil {
		t.Fatalf("upsert setting again: %v", err)
	}
	setting, err := s.FindSetting("k")
	if err != nil || setting.Value != "v2" {
		t.Fatalf("find setting: %v %+v", err, setting)
	}
}
