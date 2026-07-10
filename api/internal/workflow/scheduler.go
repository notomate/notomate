package workflow

import (
	"log"
	"sync"

	"github.com/robfig/cron/v3"

	"github.com/collabreef/collabreef/internal/db"
	"github.com/collabreef/collabreef/internal/model"
)

// Scheduler fires schedule-triggered workflows. Reload rebuilds the whole
// cron table from the database; with a single API instance an in-process
// reload after every workflow change is sufficient.
type Scheduler struct {
	db    db.DB
	queue *Queue

	mu   sync.Mutex
	cron *cron.Cron
}

func NewScheduler(database db.DB, queue *Queue) *Scheduler {
	return &Scheduler{db: database, queue: queue}
}

func (s *Scheduler) Reload() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cron != nil {
		s.cron.Stop()
	}
	c := cron.New()

	enabled := true
	workflows, err := s.db.FindWorkflows(model.WorkflowFilter{Enabled: &enabled})
	if err != nil {
		log.Printf("[workflow] load workflows for scheduler: %v", err)
	} else {
		for _, wf := range workflows {
			spec, errs := ParseAndValidate(wf.Definition)
			if len(errs) > 0 || !spec.HasSchedule() {
				continue
			}
			workflowID := wf.ID
			for _, entry := range spec.On.Schedule {
				if _, err := c.AddFunc(entry.Cron, func() { s.fire(workflowID) }); err != nil {
					log.Printf("[workflow] schedule %q for workflow %s: %v", entry.Cron, workflowID, err)
				}
			}
		}
	}

	s.cron = c
	c.Start()
}

func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cron != nil {
		s.cron.Stop()
	}
}

func (s *Scheduler) fire(workflowID string) {
	// Re-fetch: the workflow may have been edited or disabled since Reload.
	wf, err := s.db.FindWorkflow(model.Workflow{ID: workflowID})
	if err != nil || !wf.Enabled {
		return
	}
	spec, errs := ParseAndValidate(wf.Definition)
	if len(errs) > 0 || !spec.HasSchedule() {
		return
	}

	workspace, err := s.db.FindWorkspaceByID(wf.WorkspaceID)
	if err != nil {
		log.Printf("[workflow] load workspace for scheduled run of %s: %v", workflowID, err)
		return
	}

	payload := EventPayload{
		Event:     model.WorkflowEventSchedule,
		Workspace: PayloadWorkspace{ID: workspace.ID, Name: workspace.Name},
	}
	if _, err := CreateRun(s.db, wf, spec, model.WorkflowEventSchedule, payload, ""); err != nil {
		log.Printf("[workflow] create scheduled run for %s: %v", workflowID, err)
		return
	}

	s.queue.Wake()
}
