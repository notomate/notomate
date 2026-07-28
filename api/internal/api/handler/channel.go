package handler

import (
	"net/http"
	"time"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
)

type CreateChannelRequest struct {
	Name        string `json:"name" validate:"required"`
	Description string `json:"description"`
}

type UpdateChannelRequest struct {
	Name        string `json:"name" validate:"required"`
	Description string `json:"description"`
}

type GetChannelResponse struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	UpdatedAt   string `json:"updated_at"`
}

func toChannelResponse(channel model.Channel) GetChannelResponse {
	return GetChannelResponse{
		ID:          channel.ID,
		WorkspaceID: channel.WorkspaceID,
		Name:        channel.Name,
		Description: channel.Description,
		CreatedAt:   channel.CreatedAt,
		CreatedBy:   channel.CreatedBy,
		UpdatedAt:   channel.UpdatedAt,
	}
}

// findWorkspaceChannel loads a channel and verifies it belongs to the
// workspace in the URL, so a channel can't be addressed through another
// workspace's routes.
func (h Handler) findWorkspaceChannel(c echo.Context) (model.Channel, error) {
	workspaceId := c.Param("workspaceId")
	channelId := c.Param("channelId")

	channel, err := h.db.FindChannel(model.Channel{ID: channelId})
	if err != nil {
		return model.Channel{}, echo.NewHTTPError(http.StatusNotFound, "channel not found")
	}
	if channel.WorkspaceID != workspaceId {
		return model.Channel{}, echo.NewHTTPError(http.StatusNotFound, "channel not found")
	}
	return channel, nil
}

// Channels are visible to every workspace member; visibility is enforced by
// the "member" role middleware on the routes, not per-channel.
func (h Handler) GetChannels(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	channels, err := h.db.FindChannels(model.ChannelFilter{WorkspaceID: workspaceId})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := make([]GetChannelResponse, 0)
	for _, channel := range channels {
		res = append(res, toChannelResponse(channel))
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) CreateChannel(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	var req CreateChannelRequest
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

	channel := model.Channel{
		ID:          util.NewId(),
		WorkspaceID: workspaceId,
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   now,
		CreatedBy:   user.ID,
		UpdatedAt:   now,
		UpdatedBy:   user.ID,
	}

	if err := h.db.CreateChannel(channel); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusCreated, toChannelResponse(channel))
}

func (h Handler) UpdateChannel(c echo.Context) error {
	channel, err := h.findWorkspaceChannel(c)
	if err != nil {
		return err
	}

	var req UpdateChannelRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	user := c.Get("user").(model.User)
	channel.Name = req.Name
	channel.Description = req.Description
	channel.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	channel.UpdatedBy = user.ID

	if err := h.db.UpdateChannel(channel); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, toChannelResponse(channel))
}

func (h Handler) DeleteChannel(c echo.Context) error {
	channel, err := h.findWorkspaceChannel(c)
	if err != nil {
		return err
	}

	if err := h.db.DeleteChannel(channel); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
