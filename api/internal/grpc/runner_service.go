package grpcserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage"
	"github.com/notomate/notomate/internal/util"
	"github.com/notomate/notomate/internal/workflow"
)

const (
	runnerTokenPrefix  = "cbr_"
	fetchTaskPollLimit = 30 * time.Second
	lastOnlineThrottle = 30 * time.Second
)

// ---------- Request / Response types (JSON-serialized) ----------

type RegisterRequest struct {
	RegistrationToken string   `json:"registration_token"`
	Name              string   `json:"name"`
	Version           string   `json:"version"`
	Labels            []string `json:"labels"`
}
type RegisterResponse struct {
	RunnerID     string `json:"runner_id"`
	SessionToken string `json:"session_token"`
}

type FetchTaskRequest struct{}
type FetchTaskResponse struct {
	Found bool         `json:"found"`
	Job   *TaskPayload `json:"job,omitempty"`
}
type TaskPayload struct {
	JobID            string             `json:"job_id"`
	RunID            string             `json:"run_id"`
	RunNumber        int                `json:"run_number"`
	WorkspaceID      string             `json:"workspace_id"`
	WorkflowName     string             `json:"workflow_name"`
	JobName          string             `json:"job_name"`
	WorkflowYAML     string             `json:"workflow_yaml"`
	EventName        string             `json:"event_name"`
	EventPayloadJSON string             `json:"event_payload_json"`
	Vars             map[string]string  `json:"vars,omitempty"`
	Secrets          map[string]string  `json:"secrets,omitempty"`
	Files            []WorkflowFileData `json:"files,omitempty"`
}

// WorkflowFileData is one codebase file attached to a workflow. Path is a
// server-validated relative path (see util.SanitizeRelativePath); Content is
// base64-encoded automatically by encoding/json since it's a []byte field.
type WorkflowFileData struct {
	Path    string `json:"path"`
	Content []byte `json:"content"`
}

type UpdateTaskRequest struct {
	JobID   string `json:"job_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}
type UpdateTaskResponse struct {
	Cancelled bool `json:"cancelled"`
}

type UpdateLogRequest struct {
	JobID     string   `json:"job_id"`
	StartLine int      `json:"start_line"`
	Lines     []string `json:"lines"`
}
type UpdateLogResponse struct {
	AckLine   int  `json:"ack_line"`
	Cancelled bool `json:"cancelled"`
}

// ---------- Service ----------

type runnerServer struct {
	db      db.DB
	engine  *workflow.Engine
	storage storage.Storage
}

func registerRunnerServiceServer(s *grpc.Server, srv *runnerServer) {
	desc := grpc.ServiceDesc{
		ServiceName: "runner.RunnerService",
		HandlerType: (*any)(nil),
		Methods: []grpc.MethodDesc{
			makeHandler("/runner.RunnerService/Register", func(ctx context.Context, req *RegisterRequest) (interface{}, error) {
				return srv.Register(ctx, req)
			}),
			makeHandler("/runner.RunnerService/FetchTask", func(ctx context.Context, req *FetchTaskRequest) (interface{}, error) {
				return srv.FetchTask(ctx, req)
			}),
			makeHandler("/runner.RunnerService/UpdateTask", func(ctx context.Context, req *UpdateTaskRequest) (interface{}, error) {
				return srv.UpdateTask(ctx, req)
			}),
			makeHandler("/runner.RunnerService/UpdateLog", func(ctx context.Context, req *UpdateLogRequest) (interface{}, error) {
				return srv.UpdateLog(ctx, req)
			}),
		},
		Streams:  []grpc.StreamDesc{},
		Metadata: "runner.proto",
	}
	s.RegisterService(&desc, srv)
}

func hashRunnerToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *runnerServer) Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	expected, err := workflow.EnsureRegistrationToken(s.db)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "resolve registration token: %v", err)
	}
	if subtle.ConstantTimeCompare([]byte(req.RegistrationToken), []byte(expected)) != 1 {
		return nil, status.Error(codes.PermissionDenied, "invalid registration token")
	}

	name := req.Name
	if name == "" {
		name = "runner"
	}
	labels := req.Labels
	if len(labels) == 0 {
		labels = []string{"ubuntu-latest"}
	}
	labelsJSON, err := json.Marshal(labels)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "labels: %v", err)
	}

	raw := make([]byte, 20)
	if _, err := rand.Read(raw); err != nil {
		return nil, status.Errorf(codes.Internal, "generate token: %v", err)
	}
	sessionToken := runnerTokenPrefix + hex.EncodeToString(raw)

	now := time.Now().UTC().Format(time.RFC3339)
	runner := model.Runner{
		ID:           util.NewId(),
		Name:         name,
		Labels:       string(labelsJSON),
		TokenHash:    hashRunnerToken(sessionToken),
		Version:      req.Version,
		Status:       model.RunnerStatusOnline,
		LastOnlineAt: now,
		CreatedAt:    now,
	}
	if err := s.db.CreateRunner(runner); err != nil {
		return nil, status.Errorf(codes.Internal, "create runner: %v", err)
	}

	log.Printf("[gRPC] runner %q registered (id %s, labels %s)", runner.Name, runner.ID, runner.Labels)
	return &RegisterResponse{RunnerID: runner.ID, SessionToken: sessionToken}, nil
}

func (s *runnerServer) FetchTask(ctx context.Context, _ *FetchTaskRequest) (*FetchTaskResponse, error) {
	runner, err := runnerFromContext(ctx)
	if err != nil {
		return nil, err
	}

	var labels []string
	if err := json.Unmarshal([]byte(runner.Labels), &labels); err != nil {
		return nil, status.Errorf(codes.Internal, "runner labels: %v", err)
	}

	deadline := time.NewTimer(fetchTaskPollLimit)
	defer deadline.Stop()

	for {
		// Grab the wake channel before claiming so a job queued between the
		// failed claim and the select is not missed.
		wake := s.engine.WakeChan()

		job, err := s.engine.ClaimJob(runner.ID, labels)
		if err == nil {
			payload, err := s.buildTaskPayload(job)
			if err != nil {
				return nil, err
			}
			return &FetchTaskResponse{Found: true, Job: payload}, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, status.Errorf(codes.Internal, "claim job: %v", err)
		}

		select {
		case <-wake:
		case <-deadline.C:
			return &FetchTaskResponse{Found: false}, nil
		case <-ctx.Done():
			return &FetchTaskResponse{Found: false}, nil
		}
	}
}

func (s *runnerServer) buildTaskPayload(job model.WorkflowJob) (*TaskPayload, error) {
	run, err := s.db.FindWorkflowRun(model.WorkflowRun{ID: job.RunID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "load run: %v", err)
	}
	if run.Status == model.WorkflowRunStatusQueued {
		if err := s.db.UpdateWorkflowRunStatus(run.ID, model.WorkflowRunStatusRunning, time.Now().UTC().Format(time.RFC3339), ""); err != nil {
			return nil, status.Errorf(codes.Internal, "start run: %v", err)
		}
	}
	wf, err := s.db.FindWorkflow(model.Workflow{ID: run.WorkflowID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "load workflow: %v", err)
	}

	vars, secrets, err := s.loadVarsAndSecrets(job.WorkspaceID)
	if err != nil {
		return nil, err
	}

	files, err := s.loadWorkflowFiles(job.WorkspaceID)
	if err != nil {
		return nil, err
	}

	return &TaskPayload{
		JobID:            job.ID,
		RunID:            run.ID,
		RunNumber:        run.RunNumber,
		WorkspaceID:      job.WorkspaceID,
		WorkflowName:     wf.Name,
		JobName:          job.Name,
		WorkflowYAML:     wf.Definition,
		EventName:        run.Event,
		EventPayloadJSON: run.EventPayload,
		Vars:             vars,
		Secrets:          secrets,
		Files:            files,
	}, nil
}

// loadWorkflowFiles fetches and loads the workspace's codebase files (shared
// by every workflow in the workspace) so they can be shipped inline to the
// claiming runner, which writes them into the job's scratch workdir before
// executing steps. Paths are re-validated here (defense in depth) even
// though UploadWorkflowFile already validated them on the way in - never
// trust a stored value to still be safe just because it came from our own
// write path.
func (s *runnerServer) loadWorkflowFiles(workspaceID string) ([]WorkflowFileData, error) {
	rows, err := s.db.FindWorkflowFiles(workspaceID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "load workflow files: %v", err)
	}
	if len(rows) == 0 {
		return nil, nil
	}

	files := make([]WorkflowFileData, 0, len(rows))
	for _, row := range rows {
		cleanPath, err := util.SanitizeRelativePath(row.Path)
		if err != nil {
			log.Printf("[gRPC] skipping workflow file %s with invalid stored path %q: %v", row.ID, row.Path, err)
			continue
		}

		rc, err := s.storage.Load([]string{"workflow-files", workspaceID, row.StorageKey})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "load workflow file %s: %v", row.ID, err)
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, status.Errorf(codes.Internal, "read workflow file %s: %v", row.ID, err)
		}

		files = append(files, WorkflowFileData{Path: cleanPath, Content: content})
	}
	return files, nil
}

// loadVarsAndSecrets fetches the workspace's workflow vars/secrets and
// decrypts secret values for delivery to the runner that just claimed the
// job. Secrets are decrypted only at this point, right before being sent
// over the authenticated gRPC channel to the claiming runner.
func (s *runnerServer) loadVarsAndSecrets(workspaceID string) (map[string]string, map[string]string, error) {
	varRows, err := s.db.FindWorkflowVars(workspaceID)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "load vars: %v", err)
	}
	vars := make(map[string]string, len(varRows))
	for _, v := range varRows {
		vars[v.Key] = v.Value
	}

	secretRows, err := s.db.FindWorkflowSecrets(workspaceID)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "load secrets: %v", err)
	}
	secrets := make(map[string]string, len(secretRows))
	for _, sec := range secretRows {
		plaintext, err := util.Decrypt(sec.ValueEncrypted, config.C.GetString(config.APP_SECRET))
		if err != nil {
			return nil, nil, status.Errorf(codes.Internal, "decrypt secret %q: %v", sec.Key, err)
		}
		secrets[sec.Key] = plaintext
	}

	return vars, secrets, nil
}

func (s *runnerServer) UpdateTask(ctx context.Context, req *UpdateTaskRequest) (*UpdateTaskResponse, error) {
	runner, err := runnerFromContext(ctx)
	if err != nil {
		return nil, err
	}

	job, err := s.jobOwnedByRunner(req.JobID, runner.ID)
	if err != nil {
		return nil, err
	}

	switch req.Status {
	case model.WorkflowRunStatusSuccess, model.WorkflowRunStatusFailure, model.WorkflowRunStatusCancelled:
		if job.Status != model.WorkflowRunStatusRunning {
			return nil, status.Errorf(codes.FailedPrecondition, "job is %s, not running", job.Status)
		}
		now := time.Now().UTC().Format(time.RFC3339)
		if err := s.db.UpdateWorkflowJobStatus(job.ID, req.Status, "", now); err != nil {
			return nil, status.Errorf(codes.Internal, "update job: %v", err)
		}
		if err := s.rollUpRunStatus(job.RunID); err != nil {
			return nil, err
		}
	case model.WorkflowRunStatusRunning:
		// Heartbeat; nothing to update, but report cancellation below.
	default:
		return nil, status.Errorf(codes.InvalidArgument, "invalid status %q", req.Status)
	}

	cancelled, err := s.runCancelled(job.RunID)
	if err != nil {
		return nil, err
	}
	return &UpdateTaskResponse{Cancelled: cancelled}, nil
}

func (s *runnerServer) UpdateLog(ctx context.Context, req *UpdateLogRequest) (*UpdateLogResponse, error) {
	runner, err := runnerFromContext(ctx)
	if err != nil {
		return nil, err
	}

	job, err := s.jobOwnedByRunner(req.JobID, runner.ID)
	if err != nil {
		return nil, err
	}

	count, err := s.db.CountWorkflowJobLogs(job.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "count logs: %v", err)
	}

	maxLines := config.C.GetInt(config.WORKFLOW_LOG_MAX_LINES)
	lines := req.Lines
	startLine := req.StartLine

	// Idempotent retries: drop lines the server already has.
	if startLine <= count {
		overlap := count - startLine + 1
		if overlap >= len(lines) {
			return &UpdateLogResponse{AckLine: count}, nil
		}
		lines = lines[overlap:]
		startLine = count + 1
	}

	ackLine := startLine + len(lines) - 1

	if maxLines > 0 && count >= maxLines {
		// Cap reached: acknowledge without storing so the runner can move on.
		return &UpdateLogResponse{AckLine: ackLine}, nil
	}
	if maxLines > 0 && startLine+len(lines)-1 > maxLines {
		keep := maxLines - startLine + 1
		lines = append(lines[:keep], "...log output truncated: line limit reached...")
	}

	if err := s.db.AppendWorkflowJobLogs(job.ID, startLine, lines, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return nil, status.Errorf(codes.Internal, "append logs: %v", err)
	}

	cancelled, err := s.runCancelled(job.RunID)
	if err != nil {
		return nil, err
	}
	return &UpdateLogResponse{AckLine: ackLine, Cancelled: cancelled}, nil
}

func (s *runnerServer) jobOwnedByRunner(jobID, runnerID string) (model.WorkflowJob, error) {
	job, err := s.db.FindWorkflowJob(model.WorkflowJob{ID: jobID})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.WorkflowJob{}, status.Error(codes.NotFound, "job not found")
		}
		return model.WorkflowJob{}, status.Errorf(codes.Internal, "load job: %v", err)
	}
	if job.RunnerID != runnerID {
		return model.WorkflowJob{}, status.Error(codes.PermissionDenied, "job is not assigned to this runner")
	}
	return job, nil
}

// rollUpRunStatus finalizes the run once every job reached a terminal state.
// Precedence: failure > cancelled > success.
func (s *runnerServer) rollUpRunStatus(runID string) error {
	jobs, err := s.db.FindWorkflowJobs(model.WorkflowJobFilter{RunID: runID})
	if err != nil {
		return status.Errorf(codes.Internal, "load jobs: %v", err)
	}

	runStatus := model.WorkflowRunStatusSuccess
	for _, j := range jobs {
		switch j.Status {
		case model.WorkflowRunStatusQueued, model.WorkflowRunStatusRunning:
			return nil // not finished yet
		case model.WorkflowRunStatusFailure:
			runStatus = model.WorkflowRunStatusFailure
		case model.WorkflowRunStatusCancelled:
			if runStatus != model.WorkflowRunStatusFailure {
				runStatus = model.WorkflowRunStatusCancelled
			}
		}
	}

	// A user-cancelled run stays cancelled even if its last job managed to
	// finish before the runner noticed.
	if run, err := s.db.FindWorkflowRun(model.WorkflowRun{ID: runID}); err == nil &&
		run.Status == model.WorkflowRunStatusCancelled {
		runStatus = model.WorkflowRunStatusCancelled
	}

	if err := s.db.UpdateWorkflowRunStatus(runID, runStatus, "", time.Now().UTC().Format(time.RFC3339)); err != nil {
		return status.Errorf(codes.Internal, "finish run: %v", err)
	}
	return nil
}

func (s *runnerServer) runCancelled(runID string) (bool, error) {
	run, err := s.db.FindWorkflowRun(model.WorkflowRun{ID: runID})
	if err != nil {
		return false, status.Errorf(codes.Internal, "load run: %v", err)
	}
	return run.Status == model.WorkflowRunStatusCancelled, nil
}

// ---------- Auth interceptor ----------

type runnerCtxKey struct{}

func runnerFromContext(ctx context.Context) (model.Runner, error) {
	runner, ok := ctx.Value(runnerCtxKey{}).(model.Runner)
	if !ok {
		return model.Runner{}, status.Error(codes.Unauthenticated, "runner authentication required")
	}
	return runner, nil
}

// runnerAuthInterceptor authenticates /runner.RunnerService/ calls (except
// Register, which validates the registration token itself) with the runner
// session token from the authorization metadata. Collab service calls pass
// through untouched.
func runnerAuthInterceptor(database db.DB) grpc.UnaryServerInterceptor {
	var mu sync.Mutex
	lastSeen := map[string]time.Time{}

	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		if !strings.HasPrefix(info.FullMethod, "/runner.RunnerService/") ||
			info.FullMethod == "/runner.RunnerService/Register" {
			return handler(ctx, req)
		}

		md, _ := metadata.FromIncomingContext(ctx)
		var token string
		if vals := md.Get("authorization"); len(vals) > 0 {
			token = strings.TrimPrefix(vals[0], "Bearer ")
		}
		if !strings.HasPrefix(token, runnerTokenPrefix) {
			return nil, status.Error(codes.Unauthenticated, "runner session token required")
		}

		runner, err := database.FindRunnerByTokenHash(hashRunnerToken(token))
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "invalid runner session token")
		}

		// Track liveness, throttled to spare sqlite from a write per poll.
		mu.Lock()
		if time.Since(lastSeen[runner.ID]) >= lastOnlineThrottle {
			lastSeen[runner.ID] = time.Now()
			mu.Unlock()
			if err := database.UpdateRunnerStatus(runner.ID, model.RunnerStatusOnline, time.Now().UTC().Format(time.RFC3339)); err != nil {
				log.Printf("[gRPC] update runner status: %v", err)
			}
		} else {
			mu.Unlock()
		}

		return handler(context.WithValue(ctx, runnerCtxKey{}, runner), req)
	}
}
