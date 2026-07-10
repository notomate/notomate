package handler

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/collabreef/collabreef/internal/config"
	"github.com/collabreef/collabreef/internal/model"
	"github.com/collabreef/collabreef/internal/util"
)

type CreateWorkflowSecretRequest struct {
	Key   string `json:"key" validate:"required"`
	Value string `json:"value" validate:"required"`
}

type UpdateWorkflowSecretRequest struct {
	Value string `json:"value" validate:"required"`
}

func encryptionKey() string {
	return config.C.GetString(config.APP_SECRET)
}

// GetWorkflowSecrets never returns secret values: the API is write-only for
// secrets, matching GitHub Actions.
func (h Handler) GetWorkflowSecrets(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	secrets, err := h.db.FindWorkflowSecrets(workspaceId)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if secrets == nil {
		secrets = []model.WorkflowSecret{}
	}

	return c.JSON(http.StatusOK, secrets)
}

func (h Handler) CreateWorkflowSecret(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	var req CreateWorkflowSecretRequest
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

	encrypted, err := util.Encrypt(req.Value, encryptionKey())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	user := c.Get("user").(model.User)
	now := time.Now().UTC().Format(time.RFC3339)

	s := model.WorkflowSecret{
		ID:             util.NewId(),
		WorkspaceID:    workspaceId,
		Key:            req.Key,
		ValueEncrypted: encrypted,
		CreatedAt:      now,
		CreatedBy:      user.ID,
		UpdatedAt:      now,
		UpdatedBy:      user.ID,
	}

	if err := h.db.CreateWorkflowSecret(s); err != nil {
		if isUniqueConstraintErr(err) {
			return echo.NewHTTPError(http.StatusConflict, "a secret with this key already exists")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, s)
}

func (h Handler) UpdateWorkflowSecret(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	key := c.Param("key")

	var req UpdateWorkflowSecretRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	encrypted, err := util.Encrypt(req.Value, encryptionKey())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	user := c.Get("user").(model.User)
	if err := h.db.UpdateWorkflowSecret(workspaceId, key, encrypted, time.Now().UTC().Format(time.RFC3339), user.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func (h Handler) DeleteWorkflowSecret(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	key := c.Param("key")

	if err := h.db.DeleteWorkflowSecret(workspaceId, key); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
