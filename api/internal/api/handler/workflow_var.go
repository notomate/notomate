package handler

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/collabreef/collabreef/internal/model"
	"github.com/collabreef/collabreef/internal/util"
)

var workflowKeyPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

type CreateWorkflowVarRequest struct {
	Key   string `json:"key" validate:"required"`
	Value string `json:"value" validate:"required"`
}

type UpdateWorkflowVarRequest struct {
	Value string `json:"value" validate:"required"`
}

func (h Handler) GetWorkflowVars(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	vars, err := h.db.FindWorkflowVars(workspaceId)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if vars == nil {
		vars = []model.WorkflowVar{}
	}

	return c.JSON(http.StatusOK, vars)
}

func (h Handler) CreateWorkflowVar(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	var req CreateWorkflowVarRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}
	if !workflowKeyPattern.MatchString(req.Key) {
		return echo.NewHTTPError(http.StatusBadRequest, "key must match ^[A-Za-z_][A-Za-z0-9_]*$")
	}

	user := c.Get("user").(model.User)
	now := time.Now().UTC().Format(time.RFC3339)

	v := model.WorkflowVar{
		ID:          util.NewId(),
		WorkspaceID: workspaceId,
		Key:         req.Key,
		Value:       req.Value,
		CreatedAt:   now,
		CreatedBy:   user.ID,
		UpdatedAt:   now,
		UpdatedBy:   user.ID,
	}

	if err := h.db.CreateWorkflowVar(v); err != nil {
		if isUniqueConstraintErr(err) {
			return echo.NewHTTPError(http.StatusConflict, "a variable with this key already exists")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, v)
}

func (h Handler) UpdateWorkflowVar(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	key := c.Param("key")

	var req UpdateWorkflowVarRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	user := c.Get("user").(model.User)
	if err := h.db.UpdateWorkflowVar(workspaceId, key, req.Value, time.Now().UTC().Format(time.RFC3339), user.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func (h Handler) DeleteWorkflowVar(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	key := c.Param("key")

	if err := h.db.DeleteWorkflowVar(workspaceId, key); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

// isUniqueConstraintErr reports whether err looks like a unique constraint
// violation, across postgres and sqlite driver error message formats.
func isUniqueConstraintErr(err error) bool {
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}
