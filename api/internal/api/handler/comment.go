package handler

import (
	"net/http"
	"time"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
)

type CreateCommentRequest struct {
	ThreadID   string `json:"thread_id"`
	QuotedText string `json:"quoted_text"`
	Body       string `json:"body" validate:"required"`
}

type UpdateCommentRequest struct {
	Body string `json:"body" validate:"required"`
}

type GetCommentResponse struct {
	ID                 string `json:"id"`
	NoteID             string `json:"note_id"`
	ThreadID           string `json:"thread_id"`
	QuotedText         string `json:"quoted_text"`
	Body               string `json:"body"`
	Edited             bool   `json:"edited"`
	CreatedAt          string `json:"created_at"`
	CreatedBy          string `json:"created_by"`
	CreatedByName      string `json:"created_by_name"`
	CreatedByAvatarUrl string `json:"created_by_avatar_url"`
	UpdatedAt          string `json:"updated_at"`
}

func toCommentResponse(h Handler, comment model.Comment) GetCommentResponse {
	createdByName, createdByAvatarUrl := h.getUserInfoByID(comment.CreatedBy)
	return GetCommentResponse{
		ID:                 comment.ID,
		NoteID:             comment.NoteID,
		ThreadID:           comment.ThreadID,
		QuotedText:         comment.QuotedText,
		Body:               comment.Body,
		Edited:             comment.Edited,
		CreatedAt:          comment.CreatedAt,
		CreatedBy:          comment.CreatedBy,
		CreatedByName:      createdByName,
		CreatedByAvatarUrl: createdByAvatarUrl,
		UpdatedAt:          comment.UpdatedAt,
	}
}

func (h Handler) GetNoteComments(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	noteId := c.Param("noteId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}
	if noteId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "note id is required")
	}

	comments, err := h.db.FindComments(model.CommentFilter{WorkspaceID: workspaceId, NoteID: noteId})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := make([]GetCommentResponse, 0)
	for _, comment := range comments {
		res = append(res, toCommentResponse(h, comment))
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) CreateComment(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	noteId := c.Param("noteId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}
	if noteId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "note id is required")
	}

	var req CreateCommentRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	user := c.Get("user").(model.User)

	var comment model.Comment
	comment.ID = util.NewId()
	comment.WorkspaceID = workspaceId
	comment.NoteID = noteId
	comment.Body = req.Body
	comment.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	comment.CreatedBy = user.ID
	comment.UpdatedAt = comment.CreatedAt
	comment.UpdatedBy = user.ID

	if req.ThreadID == "" {
		// Starting a new thread: this comment anchors the thread.
		comment.ThreadID = comment.ID
		comment.QuotedText = req.QuotedText
	} else {
		// Replying to an existing thread: inherit the anchor's quoted text.
		threadComments, err := h.db.FindComments(model.CommentFilter{WorkspaceID: workspaceId, NoteID: noteId})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		found := false
		for _, tc := range threadComments {
			if tc.ThreadID == req.ThreadID {
				comment.ThreadID = req.ThreadID
				comment.QuotedText = tc.QuotedText
				found = true
				break
			}
		}
		if !found {
			return echo.NewHTTPError(http.StatusBadRequest, "thread not found for this note")
		}
	}

	if err := h.db.CreateComment(comment); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	h.notifyCommentEvent(model.WorkflowEventCommentCreated, comment, user.ID)

	return c.JSON(http.StatusCreated, toCommentResponse(h, comment))
}

func (h Handler) UpdateComment(c echo.Context) error {
	noteId := c.Param("noteId")
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "comment id is required")
	}

	var req UpdateCommentRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	existingComment, err := h.db.FindComment(model.Comment{ID: id})
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if existingComment.NoteID != noteId {
		return echo.NewHTTPError(http.StatusBadRequest, "comment does not belong to this note")
	}

	user := c.Get("user").(model.User)

	if existingComment.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusForbidden, "you do not have permission to edit this comment")
	}

	existingComment.Body = req.Body
	existingComment.Edited = true
	existingComment.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	existingComment.UpdatedBy = user.ID

	if err := h.db.UpdateComment(existingComment); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	h.notifyCommentEvent(model.WorkflowEventCommentUpdated, existingComment, user.ID)

	return c.JSON(http.StatusOK, toCommentResponse(h, existingComment))
}

func (h Handler) DeleteComment(c echo.Context) error {
	noteId := c.Param("noteId")
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "comment id is required")
	}

	existingComment, err := h.db.FindComment(model.Comment{ID: id})
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if existingComment.NoteID != noteId {
		return echo.NewHTTPError(http.StatusBadRequest, "comment does not belong to this note")
	}

	user := c.Get("user").(model.User)

	if existingComment.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusForbidden, "you do not have permission to delete this comment")
	}

	if err := h.db.DeleteComment(existingComment); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.notifyCommentEvent(model.WorkflowEventCommentDeleted, existingComment, user.ID)

	return c.NoContent(http.StatusNoContent)
}
