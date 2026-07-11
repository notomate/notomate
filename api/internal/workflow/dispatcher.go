package workflow

import (
	"log"
	"sync"
	"time"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
)

// maxRunsPerWorkflowPerMinute is the loop-protection backstop: a workflow
// whose jobs modify notes can retrigger itself indefinitely.
const maxRunsPerWorkflowPerMinute = 30

// Dispatcher turns note events into queued workflow runs.
//
// note.updated events are debounced per note: the collab service write-back
// fires in bursts while a note is being edited, and one run per burst is what
// users expect. created/deleted events dispatch immediately.
type Dispatcher struct {
	db       db.DB
	queue    *Queue
	debounce time.Duration

	mu      sync.Mutex
	pending map[string]*pendingUpdate
	rates   map[string][]time.Time
	stopped bool
}

type pendingUpdate struct {
	timer   *time.Timer
	note    model.Note
	actorID string
}

func NewDispatcher(database db.DB, queue *Queue) *Dispatcher {
	debounceSeconds := config.C.GetInt(config.WORKFLOW_NOTE_DEBOUNCE_SECONDS)
	if debounceSeconds <= 0 {
		debounceSeconds = 10
	}
	return &Dispatcher{
		db:       database,
		queue:    queue,
		debounce: time.Duration(debounceSeconds) * time.Second,
		pending:  map[string]*pendingUpdate{},
		rates:    map[string][]time.Time{},
	}
}

func (d *Dispatcher) NotifyNoteEvent(event string, note model.Note, actorID string) {
	d.mu.Lock()
	if d.stopped {
		d.mu.Unlock()
		return
	}

	if event != model.WorkflowEventNoteUpdated {
		d.mu.Unlock()
		go d.dispatch(event, note, actorID)
		return
	}

	if p, ok := d.pending[note.ID]; ok {
		p.note = note
		p.actorID = actorID
		p.timer.Reset(d.debounce)
		d.mu.Unlock()
		return
	}

	p := &pendingUpdate{note: note, actorID: actorID}
	p.timer = time.AfterFunc(d.debounce, func() {
		d.mu.Lock()
		delete(d.pending, note.ID)
		stopped := d.stopped
		latest := *p
		d.mu.Unlock()
		if stopped {
			return
		}
		d.dispatch(model.WorkflowEventNoteUpdated, latest.note, latest.actorID)
	})
	d.pending[note.ID] = p
	d.mu.Unlock()
}

func (d *Dispatcher) Stop() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.stopped = true
	for id, p := range d.pending {
		p.timer.Stop()
		delete(d.pending, id)
	}
}

func (d *Dispatcher) dispatch(event string, note model.Note, actorID string) {
	enabled := true
	workflows, err := d.db.FindWorkflows(model.WorkflowFilter{
		WorkspaceID: note.WorkspaceID,
		Enabled:     &enabled,
	})
	if err != nil {
		log.Printf("[workflow] load workflows for note event: %v", err)
		return
	}
	if len(workflows) == 0 {
		return
	}

	workspace, err := d.db.FindWorkspaceByID(note.WorkspaceID)
	if err != nil {
		log.Printf("[workflow] load workspace %s: %v", note.WorkspaceID, err)
		return
	}

	var sender *PayloadSender
	if actorID != "" {
		name := actorID
		if user, err := d.db.FindUserByID(actorID); err == nil {
			name = user.Name
		}
		sender = &PayloadSender{ID: actorID, Name: name}
	}

	created := false
	for _, wf := range workflows {
		spec, errs := ParseAndValidate(wf.Definition)
		if len(errs) > 0 || !spec.MatchesNoteEvent(event) {
			continue
		}
		if !d.allowRun(wf.ID) {
			log.Printf("[workflow] rate limit hit for workflow %s (%s); dropping %s event", wf.ID, wf.Name, event)
			continue
		}

		noteCopy := note
		payload := EventPayload{
			Event:     event,
			Workspace: PayloadWorkspace{ID: workspace.ID, Name: workspace.Name},
			Sender:    sender,
			Note:      &noteCopy,
		}
		if _, err := CreateRun(d.db, wf, spec, event, payload, actorID); err != nil {
			log.Printf("[workflow] create run for workflow %s: %v", wf.ID, err)
			continue
		}
		created = true
	}

	if created {
		d.queue.Wake()
	}
}

// allowRun implements the per-workflow sliding-window rate limit.
func (d *Dispatcher) allowRun(workflowID string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-time.Minute)
	recent := d.rates[workflowID][:0]
	for _, t := range d.rates[workflowID] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	if len(recent) >= maxRunsPerWorkflowPerMinute {
		d.rates[workflowID] = recent
		return false
	}
	d.rates[workflowID] = append(recent, now)
	return true
}
