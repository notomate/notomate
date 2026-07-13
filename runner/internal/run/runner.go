// Package run executes a claimed workflow job by embedding the act library
// (gitea.com/gitea/act fork), mirroring how Gitea's act_runner drives it. All
// act API usage is isolated in this package so version bumps touch one place.
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
	cfg    config.Config
	client *client.Client
}

func New(cfg config.Config, c *client.Client) *Runner {
	return &Runner{cfg: cfg, client: c}
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
	wf, err := model.ReadWorkflow(strings.NewReader(task.WorkflowYAML))
	if err != nil {
		return fmt.Errorf("parse workflow: %w", err)
	}

	plan, err := model.CombineWorkflowPlanner(wf).PlanJob(task.JobName)
	if err != nil {
		return fmt.Errorf("plan job %q: %w", task.JobName, err)
	}

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

	jobLoggerLevel := logrus.InfoLevel
	actConfig := &runner.Config{
		Workdir:               workdir,
		EventName:             task.EventName,
		EventJSON:             task.EventPayloadJSON,
		Env:                   r.jobEnv(task),
		Vars:                  task.Vars,
		Secrets:               task.Secrets,
		Platforms:             config.Platforms(r.cfg.Labels),
		ContainerDaemonSocket: r.cfg.DaemonSocket,
		LogOutput:             true,
		AutoRemove:            true,
		GitHubInstance:        "github.com",
		ContainerNamePrefix:   fmt.Sprintf("notomate-run-%d-%s", task.RunNumber, task.JobName),
		// Jobs run against a scratch workdir with no git checkout (see the
		// MkdirTemp above), so act's usual "inspect the workdir with git"
		// fallback for repo/ref/sha always fails and floods the job log with
		// warnings. Presetting the context sidesteps that codepath entirely -
		// this is the same mechanism Gitea's act_runner uses.
		PresetGitHubContext: r.githubContext(task),
		// The job container idles as "sleep <lifetime>"; without this act
		// starts it as "sleep 0" and it exits before steps run. Also acts as
		// a hard cap on job duration.
		ContainerMaxLifetime: 6 * time.Hour,
		// Without an explicit level the job logger emits act's debug noise.
		JobLoggerLevel: &jobLoggerLevel,
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

// githubContext builds a synthetic GithubContext for a job. There is no git
// checkout backing the job workdir (jobs run against a scratch temp dir), so
// every field act would normally derive by shelling out to git in the
// workdir is filled in here instead.
func (r *Runner) githubContext(task *client.TaskPayload) *model.GithubContext {
	var event map[string]any
	if task.EventPayloadJSON != "" {
		if err := json.Unmarshal([]byte(task.EventPayloadJSON), &event); err != nil {
			log.Printf("parse event payload for github context: %v", err)
		}
	}
	if event == nil {
		event = map[string]any{}
	}

	sha := sha1.Sum([]byte(task.RunID + "/" + task.JobID))

	return &model.GithubContext{
		Event:           event,
		EventName:       task.EventName,
		RunID:           task.RunID,
		RunNumber:       fmt.Sprintf("%d", task.RunNumber),
		RunAttempt:      "1",
		Actor:           "notomate",
		Repository:      "notomate/" + task.WorkspaceID,
		RepositoryOwner: "notomate",
		Ref:             "refs/heads/main",
		RefName:         "main",
		RefType:         "branch",
		Sha:             hex.EncodeToString(sha[:]),
		RetentionDays:   "0",
	}
}

// jobEnv is the Notomate context exposed to job steps.
func (r *Runner) jobEnv(task *client.TaskPayload) map[string]string {
	env := map[string]string{
		"NM_EVENT_NAME":   task.EventName,
		"NM_WORKSPACE_ID": task.WorkspaceID,
		"NM_RUN_ID":       task.RunID,
		"NM_RUN_NUMBER":   fmt.Sprintf("%d", task.RunNumber),
	}
	if serverURL := os.Getenv("NM_SERVER_URL"); serverURL != "" {
		env["NM_SERVER_URL"] = serverURL
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
