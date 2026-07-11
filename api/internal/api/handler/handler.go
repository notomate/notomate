package handler

import (
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage"
)

type Handler struct {
	db             db.DB
	storage        storage.Storage
	workflowEngine WorkflowEngine
}

// WorkflowEngine is the part of the workflow trigger engine handlers need:
// reloading cron schedules after definitions change, waking runners
// long-polling for queued jobs, and reporting note events.
type WorkflowEngine interface {
	ReloadSchedules()
	WakeQueue()
	NotifyNoteEvent(event string, note model.Note, actorID string)
}

func NewHandler(r db.DB, s storage.Storage) *Handler {
	return &Handler{
		db:      r,
		storage: s,
	}
}

// SetWorkflowEngine attaches the trigger engine. The handler works without
// one; notifications simply become no-ops.
func (h *Handler) SetWorkflowEngine(e WorkflowEngine) {
	h.workflowEngine = e
}
