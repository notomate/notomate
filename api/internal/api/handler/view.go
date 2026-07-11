package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
)

type CreateViewRequest struct {
	NoteID     string `json:"note_id"`
	Name       string `json:"name" validate:"required"`
	Type       string `json:"type" validate:"required"`
	Data       string `json:"data"`
	Visibility string `json:"visibility"`
}

type UpdateViewRequest struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Data       string `json:"data"`
	Visibility string `json:"visibility"`
}

type GetViewResponse struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	NoteID      string `json:"note_id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Data        string `json:"data"`
	Visibility  string `json:"visibility"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	UpdatedAt   string `json:"updated_at"`
	UpdatedBy   string `json:"updated_by"`
}

func (h Handler) GetViews(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	pageSize := 100
	pageNumber := 1
	if ps := c.QueryParam("pageSize"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 {
			pageSize = v
		}
	}
	if pn := c.QueryParam("pageNumber"); pn != "" {
		if v, err := strconv.Atoi(pn); err == nil && v > 0 {
			pageNumber = v
		}
	}

	viewType := c.QueryParam("type")
	noteId := c.QueryParam("noteId")

	filter := model.ViewFilter{
		WorkspaceID: workspaceId,
		NoteID:      noteId,
		ViewType:    viewType,
		PageSize:    pageSize,
		PageNumber:  pageNumber,
	}

	views, err := h.db.FindViews(filter)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := []GetViewResponse{}

	for _, v := range views {
		res = append(res, GetViewResponse{
			ID:          v.ID,
			WorkspaceID: v.WorkspaceID,
			NoteID:      v.NoteID,
			Name:        v.Name,
			Type:        v.Type,
			Data:        v.Data,
			Visibility:  v.Visibility,
			CreatedAt:   v.CreatedAt,
			CreatedBy:   h.getUserNameByID(v.CreatedBy),
			UpdatedAt:   v.UpdatedAt,
			UpdatedBy:   h.getUserNameByID(v.UpdatedBy),
		})
	}

	return c.JSON(http.StatusOK, res)
}

// GetNoteViews returns all views belonging to a specific note.
func (h Handler) GetNoteViews(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	noteId := c.Param("noteId")

	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}
	if noteId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "note id is required")
	}

	filter := model.ViewFilter{
		WorkspaceID: workspaceId,
		NoteID:      noteId,
		PageSize:    1000,
		PageNumber:  1,
	}

	views, err := h.db.FindViews(filter)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := []GetViewResponse{}
	for _, v := range views {
		res = append(res, GetViewResponse{
			ID:          v.ID,
			WorkspaceID: v.WorkspaceID,
			NoteID:      v.NoteID,
			Name:        v.Name,
			Type:        v.Type,
			Data:        v.Data,
			Visibility:  v.Visibility,
			CreatedAt:   v.CreatedAt,
			CreatedBy:   h.getUserNameByID(v.CreatedBy),
			UpdatedAt:   v.UpdatedAt,
			UpdatedBy:   h.getUserNameByID(v.UpdatedBy),
		})
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) GetView(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Workspace id is required")
	}

	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "View id is required")
	}

	v := model.View{WorkspaceID: workspaceId, ID: id}
	v, err := h.db.FindView(v)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	res := GetViewResponse{
		ID:          v.ID,
		WorkspaceID: v.WorkspaceID,
		NoteID:      v.NoteID,
		Name:        v.Name,
		Type:        v.Type,
		Data:        v.Data,
		Visibility:  v.Visibility,
		CreatedAt:   v.CreatedAt,
		CreatedBy:   h.getUserNameByID(v.CreatedBy),
		UpdatedAt:   v.UpdatedAt,
		UpdatedBy:   h.getUserNameByID(v.UpdatedBy),
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) CreateView(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}

	var req CreateViewRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	// Validate view type
	switch req.Type {
	case "map", "calendar", "kanban", "whiteboard", "spreadsheet":
	default:
		return echo.NewHTTPError(http.StatusBadRequest, "View type must be 'map', 'calendar', 'kanban', 'whiteboard', or 'spreadsheet'")
	}

	user := c.Get("user").(model.User)

	// Set default visibility to private if not provided
	visibility := req.Visibility
	if visibility == "" {
		visibility = "private"
	}

	// Validate visibility
	switch visibility {
	case "public", "workspace", "private":
	default:
		return echo.NewHTTPError(http.StatusBadRequest, "View visibility must be 'public', 'workspace', or 'private'")
	}

	v := model.View{
		WorkspaceID: workspaceId,
		NoteID:      req.NoteID,
		ID:          util.NewId(),
		Name:        req.Name,
		Type:        req.Type,
		Data:        req.Data,
		Visibility:  visibility,
		CreatedAt:   time.Now().UTC().String(),
		CreatedBy:   user.ID,
		UpdatedAt:   time.Now().UTC().String(),
		UpdatedBy:   user.ID,
	}

	err := h.db.CreateView(v)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusCreated, v)
}

func (h Handler) UpdateView(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}

	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "View id is required")
	}

	var req UpdateViewRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	existingView, err := h.db.FindView(model.View{ID: id})

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Validate view type if provided
	if req.Type != "" {
		switch req.Type {
		case "map", "calendar", "kanban", "whiteboard", "spreadsheet":
		default:
			return echo.NewHTTPError(http.StatusBadRequest, "View type must be 'map', 'calendar', 'kanban', 'whiteboard', or 'spreadsheet'")
		}
	}

	// Validate visibility if provided
	if req.Visibility != "" {
		switch req.Visibility {
		case "public", "workspace", "private":
		default:
			return echo.NewHTTPError(http.StatusBadRequest, "View visibility must be 'public', 'workspace', or 'private'")
		}
	}

	user := c.Get("user").(model.User)

	v := model.View{
		WorkspaceID: workspaceId,
		NoteID:      existingView.NoteID,
		ID:          existingView.ID,
		Name:        req.Name,
		Type:        req.Type,
		Data:        req.Data,
		Visibility:  req.Visibility,
		CreatedAt:   existingView.CreatedAt,
		CreatedBy:   existingView.CreatedBy,
		UpdatedAt:   time.Now().UTC().String(),
		UpdatedBy:   user.ID,
	}

	// If fields are empty, keep existing values
	if v.Name == "" {
		v.Name = existingView.Name
	}
	if v.Type == "" {
		v.Type = existingView.Type
	}
	if v.Visibility == "" {
		v.Visibility = existingView.Visibility
	}
	// Note: Data can be explicitly set to empty string to clear it
	// So we don't check if it's empty here

	err = h.db.UpdateView(v)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, v)
}

func (h Handler) DeleteView(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "View id is required")
	}

	view := model.View{WorkspaceID: workspaceId, ID: id}

	_, err := h.db.FindView(view)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := h.db.DeleteView(view); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h Handler) UpdateViewVisibility(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "View id is required")
	}
	visibility := c.Param("visibility")
	if visibility == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "View visibility is required")
	}

	switch visibility {
	case "public", "workspace", "private":
	default:
		return echo.NewHTTPError(http.StatusBadRequest, "View visibility is invalid")
	}

	existingView, err := h.db.FindView(model.View{ID: id})

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(model.User)

	if existingView.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	v := model.View{
		WorkspaceID: workspaceId,
		NoteID:      existingView.NoteID,
		ID:          existingView.ID,
		Name:        existingView.Name,
		Type:        existingView.Type,
		Data:        existingView.Data,
		Visibility:  visibility,
		CreatedAt:   existingView.CreatedAt,
		CreatedBy:   existingView.CreatedBy,
		UpdatedAt:   time.Now().UTC().String(),
		UpdatedBy:   user.ID,
	}

	err = h.db.UpdateView(v)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, v)
}