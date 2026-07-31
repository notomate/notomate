// Package run executes a claimed workflow job by embedding the upstream
// nektos/act library, mirroring how Gitea's act_runner drives it. All act
// API usage is isolated in this package so version bumps touch one place.
package run

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/nektos/act/pkg/artifactcache"
	"github.com/nektos/act/pkg/model"
	"github.com/nektos/act/pkg/runner"
	"github.com/sirupsen/logrus"

	"github.com/notomate/notomate-runner/internal/client"
	"github.com/notomate/notomate-runner/internal/config"
)

const (
	statusSuccess   = "success"
	statusFailure   = "failure"
	statusCancelled = "cancelled"
	statusRunning   = "running"

	heartbeatInterval = 10 * time.Second
)

type Runner struct {
	cfg          config.Config
	client       *client.Client
	cacheHandler *artifactcache.Handler
}

// New starts a Runner along with the act cache server backing
// actions/cache. Job containers run in Docker's "host" network mode (see
// config.Config.CachePort), so the cache server binds every interface
// inside the runner container and advertises the loopback address that the
// host's published port mapping forwards to — not the runner container's
// own address, which those containers can't route to.
//
// A cache server failure only degrades actions/cache to always-miss for
// job containers, so it's logged rather than fatal.
func New(cfg config.Config, c *client.Client) *Runner {
	r := &Runner{cfg: cfg, client: c}

	externalURL := fmt.Sprintf("http://127.0.0.1:%d", cfg.CachePort)
	handler, err := artifactcache.StartHandler(cfg.CacheDir, externalURL, "0.0.0.0", cfg.CachePort, logrus.StandardLogger())
	if err != nil {
		log.Printf("Cache server disabled: %v", err)
	} else {
		r.cacheHandler = handler
		log.Printf("Cache server listening on port %d", cfg.CachePort)
	}

	return r
}

// Close releases the runner's resources, including the cache server.
func (r *Runner) Close() error {
	return r.cacheHandler.Close()
}

// Run executes one task and reports its result. The returned error is for
// logging only; the outcome has already been sent via UpdateTask.
func (r *Runner) Run(ctx context.Context, task *client.TaskPayload) error {
	log.Printf("run %s job %q of workflow %q (event %s)", task.RunID, task.JobName, task.WorkflowName, task.EventName)

	jobCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	streamer := newLogStreamer(r.client, task.JobID, cancel)

	// Heartbeat so the server can signal cancellation even while a step is
	// quiet.
	stopHeartbeat := make(chan struct{})
	go func() {
		ticker := time.NewTicker(heartbeatInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				hbCtx, hbCancel := context.WithTimeout(context.Background(), 10*time.Second)
				resp, err := r.client.UpdateTask(hbCtx, &client.UpdateTaskRequest{
					JobID:  task.JobID,
					Status: statusRunning,
				})
				hbCancel()
				if err == nil && resp.Cancelled {
					cancel()
				}
			case <-stopHeartbeat:
				return
			}
		}
	}()

	execErr := r.execute(jobCtx, task, streamer)

	close(stopHeartbeat)

	status := statusSuccess
	message := ""
	switch {
	case jobCtx.Err() != nil && ctx.Err() == nil:
		status = statusCancelled
		message = "cancelled"
		streamer.Append(fmt.Sprintf("%s job cancelled", time.Now().UTC().Format(time.RFC3339)))
	case execErr != nil:
		status = statusFailure
		message = execErr.Error()
		streamer.Append(fmt.Sprintf("%s job failed: %v", time.Now().UTC().Format(time.RFC3339), execErr))
	}

	streamer.Close()

	updCtx, updCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer updCancel()
	if _, err := r.client.UpdateTask(updCtx, &client.UpdateTaskRequest{
		JobID:   task.JobID,
		Status:  status,
		Message: message,
	}); err != nil {
		return fmt.Errorf("report job result: %w", err)
	}

	log.Printf("run %s job %q finished: %s", task.RunID, task.JobName, status)
	return execErr
}

func (r *Runner) execute(ctx context.Context, task *client.TaskPayload, streamer *logStreamer) error {
	planner, err := model.NewSingleWorkflowPlanner(task.WorkflowName, strings.NewReader(task.WorkflowYAML))
	if err != nil {
		return fmt.Errorf("parse workflow: %w", err)
	}

	plan, err := planner.PlanJob(task.JobName)
	if err != nil {
		return fmt.Errorf("plan job %q: %w", task.JobName, err)
	}
	uniquifyJobNames(plan, task)

	// Jobs get an empty scratch workdir; there is no repository to check out.
	workdir, err := os.MkdirTemp("", "notomate-job")
	if err != nil {
		return fmt.Errorf("create workdir: %w", err)
	}
	defer os.RemoveAll(workdir)

	// Materialize the workflow's codebase files into the workdir so steps
	// see a directory layout equivalent to a git checkout, even though no
	// git checkout ever happens.
	if err := writeWorkflowFiles(workdir, task.Files); err != nil {
		return fmt.Errorf("write workflow files: %w", err)
	}

	// act only accepts the event payload as a file (Config.EventPath); there
	// is no field for passing the JSON inline.
	eventPath, err := writeEventFile(task.EventPayloadJSON)
	if err != nil {
		return fmt.Errorf("write event payload: %w", err)
	}
	if eventPath != "" {
		defer os.Remove(eventPath)
	}

	actConfig := &runner.Config{
		Actor:                 "notomate",
		Workdir:               workdir,
		EventName:             task.EventName,
		EventPath:             eventPath,
		Env:                   r.jobEnv(task),
		Vars:                  task.Vars,
		Secrets:               task.Secrets,
		Platforms:             config.Platforms(r.cfg.Labels),
		ContainerDaemonSocket: r.cfg.DaemonSocket,
		LogOutput:             true,
		AutoRemove:            true,
		GitHubInstance:        "github.com",
	}

	actRunner, err := runner.New(actConfig)
	if err != nil {
		return fmt.Errorf("configure act: %w", err)
	}

	execCtx := runner.WithJobLoggerFactory(ctx, &jobLoggerFactory{streamer: streamer})
	if err := actRunner.NewPlanExecutor(plan)(execCtx); err != nil {
		return fmt.Errorf("job failed: %w", err)
	}
	return nil
}

// uniquifyJobNames folds the task's job ID into every job's display name in
// the plan. act derives job container names from that display name
// (createContainerName("act", jobName)); without a per-task suffix, two
// runner instances executing a job with the same YAML key at the same time
// would collide on one Docker container name.
func uniquifyJobNames(plan *model.Plan, task *client.TaskPayload) {
	for _, stage := range plan.Stages {
		for _, run := range stage.Runs {
			job := run.Job()
			name := job.Name
			if name == "" {
				name = run.JobID
			}
			job.Name = fmt.Sprintf("notomate-run-%d-%s-%s", task.RunNumber, name, task.JobID)
		}
	}
}

// writeEventFile writes the job's event payload to a temp file for act's
// Config.EventPath, since act only loads the event JSON from disk. Returns
// an empty path (and no file) when there is no payload.
func writeEventFile(payloadJSON string) (string, error) {
	if payloadJSON == "" {
		return "", nil
	}
	f, err := os.CreateTemp("", "notomate-event-*.json")
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := f.WriteString(payloadJSON); err != nil {
		os.Remove(f.Name())
		return "", err
	}
	return f.Name(), nil
}

// jobEnv is the Notomate context exposed to job steps, plus the GitHub
// context fields act reads out of Config.Env (GithubContext.SetRef/SetSha/
// SetRepositoryAndOwner only shell out to git in the job workdir when their
// corresponding field is still empty). Presetting them all here means act
// never takes that fallback path - there is no git checkout backing the job
// workdir (jobs run against a scratch temp dir, see the MkdirTemp above), so
// it would just fail and flood the job log with warnings.
func (r *Runner) jobEnv(task *client.TaskPayload) map[string]string {
	sha := sha1.Sum([]byte(task.RunID + "/" + task.JobID))

	env := map[string]string{
		"NM_EVENT_NAME":   task.EventName,
		"NM_WORKSPACE_ID": task.WorkspaceID,
		"NM_RUN_ID":       task.RunID,
		"NM_RUN_NUMBER":   fmt.Sprintf("%d", task.RunNumber),

		"GITHUB_REPOSITORY":       "notomate/" + task.WorkspaceID,
		"GITHUB_REPOSITORY_OWNER": "notomate",
		"GITHUB_REF":              "refs/heads/main",
		"GITHUB_REF_NAME":         "main",
		"GITHUB_REF_TYPE":         "branch",
		"SHA_REF":                 hex.EncodeToString(sha[:]),
		"GITHUB_RUN_ID":           task.RunID,
		"GITHUB_RUN_NUMBER":       fmt.Sprintf("%d", task.RunNumber),
		"GITHUB_RUN_ATTEMPT":      "1",
	}
	if serverURL := os.Getenv("NM_SERVER_URL"); serverURL != "" {
		env["NM_SERVER_URL"] = serverURL
	}
	if r.cacheHandler != nil {
		env["ACTIONS_CACHE_URL"] = r.cacheHandler.ExternalURL() + "/"
	}

	var payload struct {
		Note *struct {
			ID string `json:"id"`
		} `json:"note"`
	}
	if err := json.Unmarshal([]byte(task.EventPayloadJSON), &payload); err == nil && payload.Note != nil {
		env["NM_NOTE_ID"] = payload.Note.ID
	}

	return env
}
