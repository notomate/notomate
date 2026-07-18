package workflow

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratesqlite3 "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/db/sqlitedb"
	"github.com/notomate/notomate/internal/model"
)

func setupRunTest(t *testing.T) db.DB {
	t.Helper()

	config.Init()
	// Not t.TempDir(): the gorm sqlite pool stays open past the test, which
	// makes TempDir cleanup fail on Windows.
	dir, err := os.MkdirTemp("", "workflow-run-test")
	if err != nil {
		t.Fatalf("mkdtemp: %v", err)
	}
	dsn := filepath.Join(dir, "test.db")
	config.C.Set(config.DB_DSN, dsn)

	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	driver, err := migratesqlite3.WithInstance(sqlDB, &migratesqlite3.Config{})
	if err != nil {
		t.Fatalf("migrate driver: %v", err)
	}
	m, err := migrate.NewWithDatabaseInstance("file://../../migrations/sqlite3", "main", driver)
	if err != nil {
		t.Fatalf("migrate instance: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("apply migrations: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close migration connection: %v", err)
	}

	database, err := sqlitedb.NewSqliteDB()
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	return database
}

func TestCreateRunCancelsPriorActiveRuns(t *testing.T) {
	database := setupRunTest(t)
	now := time.Now().UTC().Format(time.RFC3339)

	if err := database.CreateWorkspace(model.Workspace{ID: "ws1", Name: "ws", CreatedAt: now}); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	definition := "on: workflow_dispatch\n" +
		"concurrency:\n  group: wf1\n  cancel-in-progress: true\n" +
		"jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n"
	wf := model.Workflow{ID: "wf1", WorkspaceID: "ws1", Name: "wf", Definition: definition, Enabled: true, CreatedAt: now}
	if err := database.CreateWorkflow(wf); err != nil {
		t.Fatalf("create workflow: %v", err)
	}
	spec, errs := ParseAndValidate(definition)
	if len(errs) > 0 {
		t.Fatalf("spec errors: %v", errs)
	}
	if spec.Concurrency == nil || !spec.Concurrency.CancelInProgress {
		t.Fatalf("expected spec to have cancel-in-progress concurrency, got %+v", spec.Concurrency)
	}

	payload := EventPayload{Event: model.WorkflowEventWorkflowDispatch, Workspace: PayloadWorkspace{ID: "ws1", Name: "ws"}}

	firstRun, err := CreateRun(database, wf, spec, model.WorkflowEventWorkflowDispatch, payload, "u1")
	if err != nil {
		t.Fatalf("create first run: %v", err)
	}
	if firstRun.Status != model.WorkflowRunStatusQueued {
		t.Fatalf("expected first run queued, got %s", firstRun.Status)
	}

	secondRun, err := CreateRun(database, wf, spec, model.WorkflowEventWorkflowDispatch, payload, "u1")
	if err != nil {
		t.Fatalf("create second run: %v", err)
	}

	reloadedFirst, err := database.FindWorkflowRun(model.WorkflowRun{ID: firstRun.ID})
	if err != nil {
		t.Fatalf("find first run: %v", err)
	}
	if reloadedFirst.Status != model.WorkflowRunStatusCancelled {
		t.Fatalf("expected first run cancelled, got %s", reloadedFirst.Status)
	}
	if reloadedFirst.FinishedAt == "" {
		t.Fatalf("expected first run to have finishedAt set once cancelled with no running jobs")
	}

	firstJobs, err := database.FindWorkflowJobs(model.WorkflowJobFilter{RunID: firstRun.ID})
	if err != nil {
		t.Fatalf("find first run jobs: %v", err)
	}
	for _, job := range firstJobs {
		if job.Status != model.WorkflowRunStatusCancelled {
			t.Fatalf("expected first run job cancelled, got %s", job.Status)
		}
	}

	reloadedSecond, err := database.FindWorkflowRun(model.WorkflowRun{ID: secondRun.ID})
	if err != nil {
		t.Fatalf("find second run: %v", err)
	}
	if reloadedSecond.Status != model.WorkflowRunStatusQueued {
		t.Fatalf("expected second run to remain queued, got %s", reloadedSecond.Status)
	}
}

func TestCreateRunLeavesRunningJobUnfinishedUntilRunnerReports(t *testing.T) {
	database := setupRunTest(t)
	now := time.Now().UTC().Format(time.RFC3339)

	if err := database.CreateWorkspace(model.Workspace{ID: "ws1", Name: "ws", CreatedAt: now}); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	definition := "on: workflow_dispatch\n" +
		"concurrency:\n  group: wf1\n  cancel-in-progress: true\n" +
		"jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n"
	wf := model.Workflow{ID: "wf1", WorkspaceID: "ws1", Name: "wf", Definition: definition, Enabled: true, CreatedAt: now}
	if err := database.CreateWorkflow(wf); err != nil {
		t.Fatalf("create workflow: %v", err)
	}
	spec, errs := ParseAndValidate(definition)
	if len(errs) > 0 {
		t.Fatalf("spec errors: %v", errs)
	}

	payload := EventPayload{Event: model.WorkflowEventWorkflowDispatch, Workspace: PayloadWorkspace{ID: "ws1", Name: "ws"}}

	firstRun, err := CreateRun(database, wf, spec, model.WorkflowEventWorkflowDispatch, payload, "u1")
	if err != nil {
		t.Fatalf("create first run: %v", err)
	}
	firstJobs, err := database.FindWorkflowJobs(model.WorkflowJobFilter{RunID: firstRun.ID})
	if err != nil {
		t.Fatalf("find first run jobs: %v", err)
	}
	for _, job := range firstJobs {
		if err := database.UpdateWorkflowJobStatus(job.ID, model.WorkflowRunStatusRunning, now, ""); err != nil {
			t.Fatalf("mark job running: %v", err)
		}
	}
	if err := database.UpdateWorkflowRunStatus(firstRun.ID, model.WorkflowRunStatusRunning, now, ""); err != nil {
		t.Fatalf("mark run running: %v", err)
	}

	if _, err := CreateRun(database, wf, spec, model.WorkflowEventWorkflowDispatch, payload, "u1"); err != nil {
		t.Fatalf("create second run: %v", err)
	}

	reloadedFirst, err := database.FindWorkflowRun(model.WorkflowRun{ID: firstRun.ID})
	if err != nil {
		t.Fatalf("find first run: %v", err)
	}
	if reloadedFirst.Status != model.WorkflowRunStatusCancelled {
		t.Fatalf("expected first run cancelled, got %s", reloadedFirst.Status)
	}
	if reloadedFirst.FinishedAt != "" {
		t.Fatalf("expected first run finishedAt to stay unset while its job is still running, got %q", reloadedFirst.FinishedAt)
	}
}

func TestCreateRunWithoutCancelInProgressLeavesPriorRunsAlone(t *testing.T) {
	database := setupRunTest(t)
	now := time.Now().UTC().Format(time.RFC3339)

	if err := database.CreateWorkspace(model.Workspace{ID: "ws1", Name: "ws", CreatedAt: now}); err != nil {
		t.Fatalf("create workspace: %v", err)
	}

	for _, tc := range []struct {
		name       string
		definition string
	}{
		{
			name:       "no concurrency block",
			definition: "on: workflow_dispatch\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n",
		},
		{
			name: "cancel-in-progress false",
			definition: "on: workflow_dispatch\n" +
				"concurrency:\n  group: wf1\n  cancel-in-progress: false\n" +
				"jobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			wfID := "wf-" + t.Name()
			wf := model.Workflow{ID: wfID, WorkspaceID: "ws1", Name: "wf", Definition: tc.definition, Enabled: true, CreatedAt: now}
			if err := database.CreateWorkflow(wf); err != nil {
				t.Fatalf("create workflow: %v", err)
			}
			spec, errs := ParseAndValidate(tc.definition)
			if len(errs) > 0 {
				t.Fatalf("spec errors: %v", errs)
			}

			payload := EventPayload{Event: model.WorkflowEventWorkflowDispatch, Workspace: PayloadWorkspace{ID: "ws1", Name: "ws"}}

			firstRun, err := CreateRun(database, wf, spec, model.WorkflowEventWorkflowDispatch, payload, "u1")
			if err != nil {
				t.Fatalf("create first run: %v", err)
			}
			if _, err := CreateRun(database, wf, spec, model.WorkflowEventWorkflowDispatch, payload, "u1"); err != nil {
				t.Fatalf("create second run: %v", err)
			}

			reloadedFirst, err := database.FindWorkflowRun(model.WorkflowRun{ID: firstRun.ID})
			if err != nil {
				t.Fatalf("find first run: %v", err)
			}
			if reloadedFirst.Status != model.WorkflowRunStatusQueued {
				t.Fatalf("expected first run to remain queued, got %s", reloadedFirst.Status)
			}
		})
	}
}
