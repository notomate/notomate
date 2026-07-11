package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
)

type CreateViewObjectRequest struct {
	Name string `json:"name" validate:"required"`
	Type string `json:"type" validate:"required"`
	Data string `json:"data"`
}

type UpdateViewObjectRequest struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Data string `json:"data"`
}

type GetViewObjectResponse struct {
	ID        string `json:"id"`
	ViewID    string `json:"view_id"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	Data      string `json:"data"`
	CreatedAt string `json:"created_at"`
	CreatedBy string `json:"created_by"`
	UpdatedAt string `json:"updated_at"`
	UpdatedBy string `json:"updated_by"`
}

func (h Handler) GetViewObjects(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	viewId := c.Param("viewId")

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

	objectType := c.QueryParam("type")

	// Verify the view belongs to the workspace
	if _, err := h.db.FindView(model.View{WorkspaceID: workspaceId, ID: viewId}); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "view not found")
	}

	objects, err := h.db.FindViewObjects(model.ViewObjectFilter{
		ViewID:     viewId,
		ObjectType: objectType,
		PageSize:   pageSize,
		PageNumber: pageNumber,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := []GetViewObjectResponse{}
	for _, o := range objects {
		res = append(res, GetViewObjectResponse{
			ID:        o.ID,
			ViewID:    o.ViewID,
			Name:      o.Name,
			Type:      o.Type,
			Data:      o.Data,
			CreatedAt: o.CreatedAt,
			CreatedBy: h.getUserNameByID(o.CreatedBy),
			UpdatedAt: o.UpdatedAt,
			UpdatedBy: h.getUserNameByID(o.UpdatedBy),
		})
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) GetViewObject(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	viewId := c.Param("viewId")
	id := c.Param("id")

	if workspaceId == "" || viewId == "" || id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id, view id, and object id are required")
	}

	// Verify the view belongs to the workspace
	if _, err := h.db.FindView(model.View{WorkspaceID: workspaceId, ID: viewId}); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "view not found")
	}

	o, err := h.db.FindViewObject(model.ViewObject{ID: id})
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "view object not found")
	}

	return c.JSON(http.StatusOK, GetViewObjectResponse{
		ID:        o.ID,
		ViewID:    o.ViewID,
		Name:      o.Name,
		Type:      o.Type,
		Data:      o.Data,
		CreatedAt: o.CreatedAt,
		CreatedBy: h.getUserNameByID(o.CreatedBy),
		UpdatedAt: o.UpdatedAt,
		UpdatedBy: h.getUserNameByID(o.UpdatedBy),
	})
}

func (h Handler) CreateViewObject(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	viewId := c.Param("viewId")

	if workspaceId == "" || viewId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id and view id are required")
	}

	var req CreateViewObjectRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Validation failed: " + err.Error()})
	}

	// Verify the view belongs to the workspace
	view, err := h.db.FindView(model.View{WorkspaceID: workspaceId, ID: viewId})
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "view not found")
	}

	// Validate object type is compatible with view type
	if !isCompatibleObjectType(view.Type, req.Type) {
		return echo.NewHTTPError(http.StatusBadRequest, "object type is not compatible with view type")
	}

	user := c.Get("user").(model.User)

	o := model.ViewObject{
		ID:        util.NewId(),
		ViewID:    viewId,
		Name:      req.Name,
		Type:      req.Type,
		Data:      req.Data,
		CreatedAt: time.Now().UTC().String(),
		CreatedBy: user.ID,
		UpdatedAt: time.Now().UTC().String(),
		UpdatedBy: user.ID,
	}

	if err := h.db.CreateViewObject(o); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, o)
}

func (h Handler) UpdateViewObject(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	viewId := c.Param("viewId")
	id := c.Param("id")

	if workspaceId == "" || viewId == "" || id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id, view id, and object id are required")
	}

	var req UpdateViewObjectRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Verify the view belongs to the workspace
	if _, err := h.db.FindView(model.View{WorkspaceID: workspaceId, ID: viewId}); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "view not found")
	}

	existing, err := h.db.FindViewObject(model.ViewObject{ID: id})
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "view object not found")
	}

	user := c.Get("user").(model.User)

	updated := model.ViewObject{
		ID:        existing.ID,
		ViewID:    existing.ViewID,
		Name:      req.Name,
		Type:      req.Type,
		Data:      req.Data,
		CreatedAt: existing.CreatedAt,
		CreatedBy: existing.CreatedBy,
		UpdatedAt: time.Now().UTC().String(),
		UpdatedBy: user.ID,
	}

	if updated.Name == "" {
		updated.Name = existing.Name
	}
	if updated.Type == "" {
		updated.Type = existing.Type
	}

	if err := h.db.UpdateViewObject(updated); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, updated)
}

func (h Handler) DeleteViewObject(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	viewId := c.Param("viewId")
	id := c.Param("id")

	if workspaceId == "" || viewId == "" || id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id, view id, and object id are required")
	}

	// Verify the view belongs to the workspace
	if _, err := h.db.FindView(model.View{WorkspaceID: workspaceId, ID: viewId}); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "view not found")
	}

	if _, err := h.db.FindViewObject(model.ViewObject{ID: id}); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "view object not found")
	}

	if err := h.db.DeleteViewObject(model.ViewObject{ID: id}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

// isCompatibleObjectType checks if an object type is valid for a given view type
func isCompatibleObjectType(viewType, objectType string) bool {
	compatible := map[string][]string{
		"calendar":    {"calendar_slot"},
		"map":         {"map_marker"},
		"kanban":      {"kanban_column"},
		"whiteboard":  {"whiteboard_stroke", "whiteboard_shape", "whiteboard_text", "whiteboard_note", "whiteboard_view", "whiteboard_edge"},
		"spreadsheet": {},
	}
	allowed, ok := compatible[viewType]
	if !ok {
		return false
	}
	for _, t := range allowed {
		if t == objectType {
			return true
		}
	}
	return false
}
