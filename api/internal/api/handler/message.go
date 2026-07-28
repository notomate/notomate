package handler

import (
	"net/http"
	"time"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
)

type CreateMessageRequest struct {
	Body string `json:"body" validate:"required"`
}

type UpdateMessageRequest struct {
	Body string `json:"body" validate:"required"`
}

type GetMessageResponse struct {
	ID                 string `json:"id"`
	ChannelID          string `json:"channel_id"`
	Body               string `json:"body"`
	Edited             bool   `json:"edited"`
	CreatedAt          string `json:"created_at"`
	CreatedBy          string `json:"created_by"`
	CreatedByName      string `json:"created_by_name"`
	CreatedByAvatarUrl string `json:"created_by_avatar_url"`
	UpdatedAt          string `json:"updated_at"`
}

func toMessageResponse(h Handler, message model.Message) GetMessageResponse {
	createdByName, createdByAvatarUrl := h.getUserInfoByID(message.CreatedBy)
	return GetMessageResponse{
		ID:                 message.ID,
		ChannelID:          message.ChannelID,
		Body:               message.Body,
		Edited:             message.Edited,
		CreatedAt:          message.CreatedAt,
		CreatedBy:          message.CreatedBy,
		CreatedByName:      createdByName,
		CreatedByAvatarUrl: createdByAvatarUrl,
		UpdatedAt:          message.UpdatedAt,
	}
}

func (h Handler) GetChannelMessages(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	channelId := c.Param("channelId")

	channel, err := h.db.FindChannel(model.Channel{ID: channelId})
	if err != nil || channel.WorkspaceID != workspaceId {
		return echo.NewHTTPError(http.StatusNotFound, "channel not found")
	}

	messages, err := h.db.FindMessages(model.MessageFilter{WorkspaceID: workspaceId, ChannelID: channelId})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := make([]GetMessageResponse, 0)
	for _, message := range messages {
		res = append(res, toMessageResponse(h, message))
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) CreateMessage(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	channelId := c.Param("channelId")

	channel, err := h.db.FindChannel(model.Channel{ID: channelId})
	if err != nil || channel.WorkspaceID != workspaceId {
		return echo.NewHTTPError(http.StatusNotFound, "channel not found")
	}

	var req CreateMessageRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	user := c.Get("user").(model.User)
	now := time.Now().UTC().Format(time.RFC3339)

	message := model.Message{
		ID:          util.NewId(),
		WorkspaceID: workspaceId,
		ChannelID:   channelId,
		Body:        req.Body,
		CreatedAt:   now,
		CreatedBy:   user.ID,
		UpdatedAt:   now,
		UpdatedBy:   user.ID,
	}

	if err := h.db.CreateMessage(message); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	h.notifyMessageEvent(model.WorkflowEventMessageCreated, message, user.ID)

	return c.JSON(http.StatusCreated, toMessageResponse(h, message))
}

func (h Handler) UpdateMessage(c echo.Context) error {
	channelId := c.Param("channelId")
	id := c.Param("id")

	existingMessage, err := h.db.FindMessage(model.Message{ID: id})
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if existingMessage.ChannelID != channelId {
		return echo.NewHTTPError(http.StatusBadRequest, "message does not belong to this channel")
	}

	var req UpdateMessageRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	user := c.Get("user").(model.User)

	if existingMessage.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusForbidden, "you do not have permission to edit this message")
	}

	existingMessage.Body = req.Body
	existingMessage.Edited = true
	existingMessage.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	existingMessage.UpdatedBy = user.ID

	if err := h.db.UpdateMessage(existingMessage); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	h.notifyMessageEvent(model.WorkflowEventMessageUpdated, existingMessage, user.ID)

	return c.JSON(http.StatusOK, toMessageResponse(h, existingMessage))
}

func (h Handler) DeleteMessage(c echo.Context) error {
	channelId := c.Param("channelId")
	id := c.Param("id")

	existingMessage, err := h.db.FindMessage(model.Message{ID: id})
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if existingMessage.ChannelID != channelId {
		return echo.NewHTTPError(http.StatusBadRequest, "message does not belong to this channel")
	}

	user := c.Get("user").(model.User)

	if existingMessage.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusForbidden, "you do not have permission to delete this message")
	}

	if err := h.db.DeleteMessage(existingMessage); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.notifyMessageEvent(model.WorkflowEventMessageDeleted, existingMessage, user.ID)

	return c.NoContent(http.StatusNoContent)
}
