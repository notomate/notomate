package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
)

type CreateNoteRequest struct {
	Visibility string `json:"visibility"  validate:"required"`
	Title      string `json:"title"`
	Content    string `json:"content"`
	ParentID   string `json:"parent_id"`
}

type UpdateNoteRequest struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	ParentID string `json:"parent_id"`
}

type GetNoteResponse struct {
	ID          string   `json:"id"`
	WorkspaceID string   `json:"workspace_id"`
	ParentID    string   `json:"parent_id"`
	Visibility  string   `json:"visibility"`
	Pinned      bool     `json:"pinned"`
	Title       string   `json:"title"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
	Files       []string `json:"files"`
	CreatedAt   string   `json:"created_at"`
	CreatedBy   string   `json:"created_by"`
	UpdatedAt   string   `json:"updated_at"`
	UpdatedBy   string   `json:"updated_by"`
}

// Helper function to get username by user ID
func (h Handler) getUserNameByID(userID string) string {
	if userID == "" {
		return ""
	}
	user, err := h.db.FindUserByID(userID)
	if err != nil {
		return userID // Return ID if user not found
	}
	return user.Name
}

// Helper function to check if a user is a member of a workspace
func (h Handler) isUserWorkspaceMember(userID string, workspaceID string) bool {
	if userID == "" || workspaceID == "" {
		return false
	}

	users, err := h.db.FindWorkspaceUsers(model.WorkspaceUserFilter{WorkspaceID: workspaceID})
	if err != nil {
		return false
	}

	for _, u := range users {
		if u.UserID == userID {
			return true
		}
	}

	return false
}

func (h Handler) GetPublicNotes(c echo.Context) error {
	pageSize := 20
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

	query := c.QueryParam("query")

	filter := model.NoteFilter{
		PageSize:   pageSize,
		PageNumber: pageNumber,
		Query:      query,
		ParentID:   "null",
	}

	notes, err := h.db.FindNotes(filter)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := make([]GetNoteResponse, 0)
	for _, b := range notes {
		res = append(res, GetNoteResponse{
			ID:          b.ID,
			WorkspaceID: b.WorkspaceID,
			ParentID:    b.ParentID,
			Visibility:  b.Visibility,
			Pinned:      b.Pinned,
			Title:       b.Title,
			Content:     b.Content,
			CreatedAt:   b.CreatedAt,
			CreatedBy:   h.getUserNameByID(b.CreatedBy),
			UpdatedAt:   b.UpdatedAt,
			UpdatedBy:   h.getUserNameByID(b.UpdatedBy),
		})
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) GetNotes(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	pageSize := 20
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

	query := c.QueryParam("query")
	sortBy := c.QueryParam("sort")
	if sortBy != "updated_at" {
		sortBy = "created_at"
	}
	parentID := c.QueryParam("parentId")
	pinnedOnly := c.QueryParam("pinned") == "true"

	user := c.Get("user").(model.User)

	filter := model.NoteFilter{
		WorkspaceID: workspaceId,
		PageSize:    pageSize,
		PageNumber:  pageNumber,
		UserID:      user.ID,
		Query:       query,
		SortBy:      sortBy,
		ParentID:    parentID,
		PinnedOnly:  pinnedOnly,
	}

	notes, err := h.db.FindNotes(filter)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := make([]GetNoteResponse, 0)

	for _, b := range notes {
		res = append(res, GetNoteResponse{
			ID:          b.ID,
			WorkspaceID: b.WorkspaceID,
			ParentID:    b.ParentID,
			Visibility:  b.Visibility,
			Pinned:      b.Pinned,
			Title:       b.Title,
			Content:     b.Content,
			CreatedAt:   b.CreatedAt,
			CreatedBy:   h.getUserNameByID(b.CreatedBy),
			UpdatedAt:   b.UpdatedAt,
			UpdatedBy:   h.getUserNameByID(b.UpdatedBy),
		})
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) GetNote(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Workspace id is required")
	}

	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Note id is required")
	}

	b := model.Note{WorkspaceID: workspaceId, ID: id}
	b, err := h.db.FindNote(b)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	user := c.Get("user").(model.User)

	isVisible := false

	switch b.Visibility {
	case "public", "workspace":
		isVisible = true
	case "private":
		isVisible = b.CreatedBy == user.ID
	}

	if !isVisible {
		return echo.NewHTTPError(http.StatusForbidden, "you do not have permission to see this Note")
	}

	res := GetNoteResponse{
		ID:          b.ID,
		WorkspaceID: b.WorkspaceID,
		ParentID:    b.ParentID,
		Visibility:  b.Visibility,
		Title:       b.Title,
		Content:     b.Content,
		CreatedAt:   b.CreatedAt,
		CreatedBy:   h.getUserNameByID(b.CreatedBy),
		UpdatedAt:   b.UpdatedAt,
		UpdatedBy:   h.getUserNameByID(b.UpdatedBy),
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) CreateNote(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}
	var req CreateNoteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	var n model.Note
	user := c.Get("user").(model.User)

	// Check if content is markdown and convert to TipTap JSON
	content := req.Content
	contentFormat := c.Request().Header.Get("X-Content-Format")
	if strings.ToLower(contentFormat) == "markdown" {
		tiptapJSON, err := util.MarkdownToTipTap(req.Content)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Failed to convert markdown: "+err.Error())
		}
		content = tiptapJSON
	}

	n.WorkspaceID = workspaceId
	n.ID = util.NewId()
	n.ParentID = req.ParentID
	n.Visibility = req.Visibility
	n.Title = req.Title
	n.Content = content
	n.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	n.CreatedBy = user.ID
	n.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	n.UpdatedBy = user.ID

	err := h.db.CreateNote(n)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	h.notifyNoteEvent(model.WorkflowEventNoteCreated, n, user.ID)

	return c.JSON(http.StatusCreated, n)
}

func (h Handler) DeleteNote(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Note id is required")
	}
	Note := model.Note{WorkspaceID: workspaceId, ID: id}

	existingNote, err := h.db.FindNote(Note)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(model.User)

	if existingNote.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusForbidden, "you do not have permission to delete this Note")
	}

	if err := h.db.DeleteNote(Note); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.notifyNoteEvent(model.WorkflowEventNoteDeleted, existingNote, user.ID)

	return c.NoContent(http.StatusNoContent)
}

func (h Handler) UpdateNote(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Note id is required")
	}

	var req UpdateNoteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	existingNote, err := h.db.FindNote(model.Note{ID: id})

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(model.User)

	if existingNote.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	// Check if content is markdown and convert to TipTap JSON
	content := req.Content
	contentFormat := c.Request().Header.Get("X-Content-Format")
	if strings.ToLower(contentFormat) == "markdown" {
		tiptapJSON, err := util.MarkdownToTipTap(req.Content)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Failed to convert markdown: "+err.Error())
		}
		content = tiptapJSON
	}

	var n model.Note

	n.WorkspaceID = workspaceId
	n.ID = existingNote.ID
	n.ParentID = req.ParentID
	n.Title = req.Title
	n.Content = content
	n.Visibility = existingNote.Visibility
	n.CreatedAt = existingNote.CreatedAt
	n.CreatedBy = existingNote.CreatedBy
	n.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	n.UpdatedBy = user.ID

	err = h.db.UpdateNote(n)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	h.notifyNoteEvent(model.WorkflowEventNoteUpdated, n, user.ID)

	return c.JSON(http.StatusOK, existingNote)
}

func (h Handler) UpdateNoteVisibility(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Note id is required")
	}
	visibility := c.Param("visibility")
	if visibility == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Note visibility is required")
	}

	switch visibility {
	case "public", "workspace", "private":
	default:
		return echo.NewHTTPError(http.StatusBadRequest, "Note visibility is invalid")
	}

	existingNote, err := h.db.FindNote(model.Note{ID: id})

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(model.User)

	if existingNote.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var n model.Note

	n.WorkspaceID = workspaceId
	n.ID = existingNote.ID
	n.ParentID = existingNote.ParentID
	n.Visibility = visibility
	n.Pinned = existingNote.Pinned
	n.Title = existingNote.Title
	n.Content = existingNote.Content
	n.CreatedAt = existingNote.CreatedAt
	n.CreatedBy = existingNote.CreatedBy
	n.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	n.UpdatedBy = user.ID

	err = h.db.UpdateNote(n)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	h.notifyNoteEvent(model.WorkflowEventNoteUpdated, n, user.ID)

	return c.JSON(http.StatusOK, n)
}

func (h Handler) UpdateNotePin(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Note id is required")
	}

	var pinned bool
	switch c.Param("pinned") {
	case "true":
		pinned = true
	case "false":
		pinned = false
	default:
		return echo.NewHTTPError(http.StatusBadRequest, "Note pinned value is invalid")
	}

	existingNote, err := h.db.FindNote(model.Note{ID: id})

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(model.User)

	if existingNote.CreatedBy != user.ID {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var n model.Note

	n.WorkspaceID = workspaceId
	n.ID = existingNote.ID
	n.ParentID = existingNote.ParentID
	n.Visibility = existingNote.Visibility
	n.Pinned = pinned
	n.Title = existingNote.Title
	n.Content = existingNote.Content
	n.CreatedAt = existingNote.CreatedAt
	n.CreatedBy = existingNote.CreatedBy
	n.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	n.UpdatedBy = user.ID

	err = h.db.UpdateNote(n)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	h.notifyNoteEvent(model.WorkflowEventNoteUpdated, n, user.ID)

	return c.JSON(http.StatusOK, n)
}
