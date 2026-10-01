package handler

import (
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/googlemaps"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage"
)

type Handler struct {
	db             db.DB
	storage        storage.Storage
	workflowEngine WorkflowEngine
	googleMaps     *googlemaps.Service
}

// WorkflowEngine is the part of the workflow trigger engine handlers need:
// reloading cron schedules after definitions change, waking runners
// long-polling for queued jobs, and reporting note/comment/message events.
// Room-created/client-connected/client-disconnected events are only ever
// reported by the gRPC MessagingService, which holds a concrete
// *workflow.Engine directly, so they aren't part of this interface.
type WorkflowEngine interface {
	ReloadSchedules()
	WakeQueue()
	NotifyNoteEvent(event string, note model.Note, actorID string)
	NotifyCommentEvent(event string, comment model.Comment, actorID string)
	NotifyMessageSent(message model.Message, actorID string)
}

func NewHandler(r db.DB, s storage.Storage) *Handler {
	return &Handler{
		db:         r,
		storage:    s,
		googleMaps: googlemaps.NewService(r, s, googlemaps.NewClient(), encryptionKey),
	}
}

// GoogleMaps exposes the Google Maps service so the server can start its
// cache janitor.
func (h *Handler) GoogleMaps() *googlemaps.Service {
	return h.googleMaps
}

// SetWorkflowEngine attaches the trigger engine. The handler works without
// one; notifications simply become no-ops.
func (h *Handler) SetWorkflowEngine(e WorkflowEngine) {
	h.workflowEngine = e
}
