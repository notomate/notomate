package workflow

import (
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/robfig/cron/v3"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

const fireAttempts = 3

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

// fire creates a run for a scheduled workflow. Database errors (e.g. a
// locked SQLite file while other schedules fire in the same minute) are
// retried, so a tick isn't silently lost.
func (s *Scheduler) fire(workflowID string) {
	for attempt := 1; ; attempt++ {
		err := s.tryFire(workflowID)
		if err == nil {
			return
		}
		if attempt == fireAttempts {
			log.Printf("[workflow] scheduled run for %s failed after %d attempts: %v", workflowID, attempt, err)
			return
		}
		log.Printf("[workflow] scheduled run for %s (attempt %d): %v; retrying", workflowID, attempt, err)
		time.Sleep(time.Duration(attempt) * 2 * time.Second)
	}
}

func (s *Scheduler) tryFire(workflowID string) error {
	// Re-fetch: the workflow may have been edited, disabled or deleted since Reload.
	wf, err := s.db.FindWorkflow(model.Workflow{ID: workflowID})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("load workflow: %w", err)
	}
	if !wf.Enabled {
		return nil
	}
	spec, errs := ParseAndValidate(wf.Definition)
	if len(errs) > 0 || !spec.HasSchedule() {
		return nil
	}

	workspace, err := s.db.FindWorkspaceByID(wf.WorkspaceID)
	if err != nil {
		return fmt.Errorf("load workspace: %w", err)
	}

	payload := EventPayload{
		Event:     model.WorkflowEventSchedule,
		Workspace: PayloadWorkspace{ID: workspace.ID, Name: workspace.Name},
	}
	if _, err := CreateRun(s.db, wf, spec, model.WorkflowEventSchedule, payload, ""); err != nil {
		return fmt.Errorf("create run: %w", err)
	}

	s.queue.Wake()
	return nil
}
