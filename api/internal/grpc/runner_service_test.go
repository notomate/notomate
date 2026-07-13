package grpcserver

import (
	"context"
	"database/sql"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratesqlite3 "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/db/sqlitedb"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage/localfile"
	"github.com/notomate/notomate/internal/workflow"
)

const testRegistrationToken = "test-registration-token"

func setupRunnerTest(t *testing.T) (db.DB, *workflow.Engine, *grpc.ClientConn) {
	t.Helper()

	config.Init()
	// Not t.TempDir(): the gorm sqlite pool stays open past the test, which
	// makes TempDir cleanup fail on Windows.
	dir, err := os.MkdirTemp("", "runner-grpc-test")
	if err != nil {
		t.Fatalf("mkdtemp: %v", err)
	}
	dsn := filepath.Join(dir, "test.db")
	config.C.Set(config.DB_DSN, dsn)
	config.C.Set(config.RUNNER_REGISTRATION_TOKEN, testRegistrationToken)

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

	engine := workflow.NewEngine(database)

	store := localfile.NewLocalFileStorage(filepath.ToSlash(dir) + "/uploads/")

	lis := bufconn.Listen(1024 * 1024)
	srv := NewServer(database, engine, store)
	go srv.Serve(lis)
	t.Cleanup(srv.Stop)

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	return database, engine, conn
}

func authCtx(ctx context.Context, token string) context.Context {
	return metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
}

func createTestRun(t *testing.T, database db.DB, engine *workflow.Engine) model.WorkflowRun {
	t.Helper()

	now := time.Now().UTC().Format(time.RFC3339)
	definition := "on: workflow_dispatch\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n"

	if _, err := database.FindWorkspaceByID("ws1"); err != nil {
		if err := database.CreateWorkspace(model.Workspace{ID: "ws1", Name: "ws", CreatedAt: now}); err != nil {
			t.Fatalf("create workspace: %v", err)
		}
		if err := database.CreateWorkflow(model.Workflow{
			ID: "wf1", WorkspaceID: "ws1", Name: "wf", Definition: definition, Enabled: true, CreatedAt: now,
		}); err != nil {
			t.Fatalf("create workflow: %v", err)
		}
	}

	wf, err := database.FindWorkflow(model.Workflow{ID: "wf1"})
	if err != nil {
		t.Fatalf("find workflow: %v", err)
	}
	spec, errs := workflow.ParseAndValidate(wf.Definition)
	if len(errs) > 0 {
		t.Fatalf("spec errors: %v", errs)
	}
	run, err := workflow.CreateRun(database, wf, spec, model.WorkflowEventWorkflowDispatch, workflow.EventPayload{
		Event:     model.WorkflowEventWorkflowDispatch,
		Workspace: workflow.PayloadWorkspace{ID: "ws1", Name: "ws"},
	}, "u1")
	if err != nil {
		t.Fatalf("create run: %v", err)
	}
	engine.WakeQueue()
	return run
}

func TestRunnerProtocol(t *testing.T) {
	database, engine, conn := setupRunnerTest(t)
	ctx := context.Background()

	// Registration with a bad token is rejected.
	var regResp RegisterResponse
	err := conn.Invoke(ctx, "/runner.RunnerService/Register",
		&RegisterRequest{RegistrationToken: "wrong", Name: "r1"}, &regResp)
	if status.Code(err) != codes.PermissionDenied {
		t.Fatalf("expected PermissionDenied, got %v", err)
	}

	// Registration with the correct token succeeds.
	err = conn.Invoke(ctx, "/runner.RunnerService/Register",
		&RegisterRequest{
			RegistrationToken: testRegistrationToken,
			Name:              "r1",
			Version:           "test",
			Labels:            []string{"ubuntu-latest", "docker"},
		}, &regResp)
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if regResp.RunnerID == "" || len(regResp.SessionToken) < 10 {
		t.Fatalf("unexpected register response: %+v", regResp)
	}
	token := regResp.SessionToken

	// Unauthenticated FetchTask is rejected.
	var fetchResp FetchTaskResponse
	err = conn.Invoke(ctx, "/runner.RunnerService/FetchTask", &FetchTaskRequest{}, &fetchResp)
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated, got %v", err)
	}

	// FetchTask with nothing queued long-polls until the client context
	// expires (the client sees DeadlineExceeded, never a job).
	shortCtx, cancel := context.WithTimeout(authCtx(ctx, token), time.Second)
	err = conn.Invoke(shortCtx, "/runner.RunnerService/FetchTask", &FetchTaskRequest{}, &fetchResp)
	cancel()
	if status.Code(err) != codes.DeadlineExceeded && (err != nil || fetchResp.Found) {
		t.Fatalf("expected empty fetch, got %+v err %v", fetchResp, err)
	}

	// A long-polling FetchTask is woken by a dispatched run.
	type fetchResult struct {
		resp FetchTaskResponse
		err  error
	}
	resCh := make(chan fetchResult, 1)
	go func() {
		pollCtx, cancel := context.WithTimeout(authCtx(ctx, token), 10*time.Second)
		defer cancel()
		var resp FetchTaskResponse
		err := conn.Invoke(pollCtx, "/runner.RunnerService/FetchTask", &FetchTaskRequest{}, &resp)
		resCh <- fetchResult{resp, err}
	}()

	time.Sleep(300 * time.Millisecond)
	run := createTestRun(t, database, engine)

	res := <-resCh
	if res.err != nil || !res.resp.Found {
		t.Fatalf("long poll fetch failed: %+v err %v", res.resp, res.err)
	}
	job := res.resp.Job
	if job.RunID != run.ID || job.JobName != "build" || job.EventName != model.WorkflowEventWorkflowDispatch || job.WorkflowYAML == "" {
		t.Fatalf("unexpected task payload: %+v", job)
	}

	// The run flipped to running when the job was handed out.
	dbRun, err := database.FindWorkflowRun(model.WorkflowRun{ID: run.ID})
	if err != nil || dbRun.Status != model.WorkflowRunStatusRunning {
		t.Fatalf("expected running run, got %+v err %v", dbRun, err)
	}

	// Stream logs, including an idempotent retry of the same lines.
	var logResp UpdateLogResponse
	err = conn.Invoke(authCtx(ctx, token), "/runner.RunnerService/UpdateLog",
		&UpdateLogRequest{JobID: job.JobID, StartLine: 1, Lines: []string{"a", "b"}}, &logResp)
	if err != nil || logResp.AckLine != 2 {
		t.Fatalf("update log: %+v err %v", logResp, err)
	}
	err = conn.Invoke(authCtx(ctx, token), "/runner.RunnerService/UpdateLog",
		&UpdateLogRequest{JobID: job.JobID, StartLine: 1, Lines: []string{"a", "b", "c"}}, &logResp)
	if err != nil || logResp.AckLine != 3 {
		t.Fatalf("retry update log: %+v err %v", logResp, err)
	}
	lines, err := database.FindWorkflowJobLogs(job.JobID, 0, 10)
	if err != nil || len(lines) != 3 {
		t.Fatalf("expected 3 log lines, got %d err %v", len(lines), err)
	}

	// Finish the job; the run rolls up to success.
	var taskResp UpdateTaskResponse
	err = conn.Invoke(authCtx(ctx, token), "/runner.RunnerService/UpdateTask",
		&UpdateTaskRequest{JobID: job.JobID, Status: model.WorkflowRunStatusSuccess}, &taskResp)
	if err != nil || taskResp.Cancelled {
		t.Fatalf("update task: %+v err %v", taskResp, err)
	}
	dbRun, err = database.FindWorkflowRun(model.WorkflowRun{ID: run.ID})
	if err != nil || dbRun.Status != model.WorkflowRunStatusSuccess || dbRun.FinishedAt == "" {
		t.Fatalf("expected finished successful run, got %+v err %v", dbRun, err)
	}

	// A second runner cannot touch the finished job.
	err = conn.Invoke(ctx, "/runner.RunnerService/Register",
		&RegisterRequest{RegistrationToken: testRegistrationToken, Name: "r2"}, &regResp)
	if err != nil {
		t.Fatalf("register second runner: %v", err)
	}
	err = conn.Invoke(authCtx(ctx, regResp.SessionToken), "/runner.RunnerService/UpdateTask",
		&UpdateTaskRequest{JobID: job.JobID, Status: model.WorkflowRunStatusFailure}, &taskResp)
	if status.Code(err) != codes.PermissionDenied {
		t.Fatalf("expected PermissionDenied for foreign job, got %v", err)
	}
}
