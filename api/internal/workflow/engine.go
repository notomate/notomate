package workflow

import (
	"log"
	"sync"
	"time"

	"github.com/collabreef/collabreef/internal/config"
	"github.com/collabreef/collabreef/internal/db"
	"github.com/collabreef/collabreef/internal/model"
)

// Engine ties together the note-event dispatcher, the cron scheduler and the
// job queue. A single instance lives in the API process; handlers and the
// runner gRPC service both talk to it.
type Engine struct {
	db         db.DB
	queue      *Queue
	dispatcher *Dispatcher
	scheduler  *Scheduler
	stopPrune  chan struct{}
}

func NewEngine(database db.DB) *Engine {
	q := NewQueue()
	return &Engine{
		db:         database,
		queue:      q,
		dispatcher: NewDispatcher(database, q),
		scheduler:  NewScheduler(database, q),
		stopPrune:  make(chan struct{}),
	}
}

// Start loads cron schedules, begins firing them and starts the retention
// pruner.
func (e *Engine) Start() {
	e.scheduler.Reload()
	go e.pruneLoop()
}

func (e *Engine) Stop() {
	e.scheduler.Stop()
	e.dispatcher.Stop()
	close(e.stopPrune)
}

// pruneLoop deletes terminal runs (with their jobs and logs) older than
// WORKFLOW_RUN_RETENTION_DAYS, once at startup and then every 12 hours.
func (e *Engine) pruneLoop() {
	retentionDays := config.C.GetInt(config.WORKFLOW_RUN_RETENTION_DAYS)
	if retentionDays <= 0 {
		return
	}

	prune := func() {
		cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays).Format(time.RFC3339)
		if err := e.db.DeleteWorkflowRunsBefore(cutoff); err != nil {
			log.Printf("[workflow] prune runs before %s: %v", cutoff, err)
		}
	}

	prune()
	ticker := time.NewTicker(12 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			prune()
		case <-e.stopPrune:
			return
		}
	}
}

// ReloadSchedules rebuilds cron entries after workflow definitions change.
func (e *Engine) ReloadSchedules() {
	e.scheduler.Reload()
}

// WakeQueue wakes runners long-polling for queued jobs.
func (e *Engine) WakeQueue() {
	e.queue.Wake()
}

// NotifyNoteEvent reports a note change from either write path (REST handler
// or collab gRPC write-back).
func (e *Engine) NotifyNoteEvent(event string, note model.Note, actorID string) {
	e.dispatcher.NotifyNoteEvent(event, note, actorID)
}

// ClaimJob hands the oldest matching queued job to a runner.
func (e *Engine) ClaimJob(runnerID string, labels []string) (model.WorkflowJob, error) {
	return e.queue.Claim(e.db, runnerID, labels)
}

// WakeChan returns a channel closed on the next queue wake-up; long-pollers
// select on it.
func (e *Engine) WakeChan() <-chan struct{} {
	return e.queue.WakeChan()
}

// Queue coordinates queued-job handoff between the trigger sources and
// long-polling runners. Claims are serialized so sqlite never sees two
// concurrent claim transactions.
type Queue struct {
	mu      sync.Mutex
	wake    chan struct{}
	claimMu sync.Mutex
}

func NewQueue() *Queue {
	return &Queue{wake: make(chan struct{})}
}

// Wake releases every waiter by closing the current wake channel and
// replacing it with a fresh one.
func (q *Queue) Wake() {
	q.mu.Lock()
	defer q.mu.Unlock()
	close(q.wake)
	q.wake = make(chan struct{})
}

func (q *Queue) WakeChan() <-chan struct{} {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.wake
}

func (q *Queue) Claim(database db.DB, runnerID string, labels []string) (model.WorkflowJob, error) {
	q.claimMu.Lock()
	defer q.claimMu.Unlock()
	return database.ClaimQueuedWorkflowJob(runnerID, labels)
}
