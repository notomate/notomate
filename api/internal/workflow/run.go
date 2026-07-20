package workflow

import (
	"context"
	"encoding/json"
	"time"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
)

// EventPayload is the JSON document a run is created with. It is exposed to
// jobs as the GitHub-style event payload file.
type EventPayload struct {
	Event     string            `json:"event"`
	Workspace PayloadWorkspace  `json:"workspace"`
	Sender    *PayloadSender    `json:"sender,omitempty"`
	Note      *model.Note       `json:"note,omitempty"`
	Comment   *model.Comment    `json:"comment,omitempty"`
	Inputs    map[string]string `json:"inputs,omitempty"`
}

type PayloadWorkspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type PayloadSender struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CreateRun creates a queued run for the workflow, with one queued job per
// job defined in the spec, inside a single transaction. It returns the
// created run.
func CreateRun(database db.DB, wf model.Workflow, spec Spec, event string, payload EventPayload, triggeredBy string) (model.WorkflowRun, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return model.WorkflowRun{}, err
	}

	tx, err := database.Begin(context.Background())
	if err != nil {
		return model.WorkflowRun{}, err
	}
	defer tx.Rollback()

	runNumber, err := tx.NextWorkflowRunNumber(wf.ID)
	if err != nil {
		return model.WorkflowRun{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)

	// Concurrency: only workflows that declare a `concurrency:` block with
	// `cancel-in-progress: true` get the GitHub Actions cancel-in-progress
	// behaviour. The group itself isn't persisted anywhere - without
	// expression support it's a constant per workflow, so "same group" and
	// "same workflow" are equivalent and workflow_id already gives us that.
	if spec.Concurrency != nil && spec.Concurrency.CancelInProgress {
		if err := cancelActiveRuns(tx, wf.ID, now); err != nil {
			return model.WorkflowRun{}, err
		}
	}

	run := model.WorkflowRun{
		ID:           util.NewId(),
		WorkflowID:   wf.ID,
		WorkspaceID:  wf.WorkspaceID,
		RunNumber:    runNumber,
		Event:        event,
		EventPayload: string(payloadJSON),
		Status:       model.WorkflowRunStatusQueued,
		TriggeredBy:  triggeredBy,
		CreatedAt:    now,
	}
	if err := tx.CreateWorkflowRun(run); err != nil {
		return model.WorkflowRun{}, err
	}

	for name, jobSpec := range spec.Jobs {
		runsOn, err := json.Marshal(jobSpec.RunsOn)
		if err != nil {
			return model.WorkflowRun{}, err
		}
		job := model.WorkflowJob{
			ID:          util.NewId(),
			RunID:       run.ID,
			WorkspaceID: wf.WorkspaceID,
			Name:        name,
			RunsOn:      string(runsOn),
			Status:      model.WorkflowRunStatusQueued,
			CreatedAt:   now,
		}
		if err := tx.CreateWorkflowJob(job); err != nil {
			return model.WorkflowRun{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return model.WorkflowRun{}, err
	}

	return run, nil
}

// cancelActiveRuns cancels every queued or running run of a workflow, ahead
// of a new run's creation.
func cancelActiveRuns(database db.DB, workflowID string, now string) error {
	for _, status := range []string{model.WorkflowRunStatusQueued, model.WorkflowRunStatusRunning} {
		runs, err := database.FindWorkflowRuns(model.WorkflowRunFilter{WorkflowID: workflowID, Status: status})
		if err != nil {
			return err
		}
		for _, run := range runs {
			if err := CancelRun(database, run, now); err != nil {
				return err
			}
		}
	}
	return nil
}

// CancelRun cancels a single non-terminal run. Queued jobs are marked
// cancelled immediately, since they are never claimed by a runner. Running
// jobs are left as-is: the runner observes the run's cancelled status on its
// next heartbeat/log flush, aborts and reports back a terminal status, so the
// run's finishedAt is only set here once nothing is still running.
func CancelRun(database db.DB, run model.WorkflowRun, now string) error {
	if model.IsTerminalWorkflowRunStatus(run.Status) {
		return nil
	}

	jobs, err := database.FindWorkflowJobs(model.WorkflowJobFilter{RunID: run.ID})
	if err != nil {
		return err
	}

	stillRunning := false
	for _, job := range jobs {
		switch job.Status {
		case model.WorkflowRunStatusQueued:
			if err := database.UpdateWorkflowJobStatus(job.ID, model.WorkflowRunStatusCancelled, "", now); err != nil {
				return err
			}
		case model.WorkflowRunStatusRunning:
			stillRunning = true
		}
	}

	finishedAt := now
	if stillRunning {
		finishedAt = ""
	}
	return database.UpdateWorkflowRunStatus(run.ID, model.WorkflowRunStatusCancelled, "", finishedAt)
}
