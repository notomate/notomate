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
