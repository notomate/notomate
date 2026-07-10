package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/collabreef/collabreef/internal/model"
	"github.com/collabreef/collabreef/internal/util"
	"github.com/collabreef/collabreef/internal/workflow"
)

type CreateWorkflowRequest struct {
	Name       string `json:"name" validate:"required"`
	Definition string `json:"definition" validate:"required"`
}

type UpdateWorkflowRequest struct {
	Name       string `json:"name" validate:"required"`
	Definition string `json:"definition" validate:"required"`
}

type UpdateWorkflowEnabledRequest struct {
	Enabled *bool `json:"enabled" validate:"required"`
}

type DispatchWorkflowRequest struct {
	Inputs map[string]string `json:"inputs"`
}

// findWorkspaceWorkflow loads a workflow and verifies it belongs to the
// workspace in the URL, so a workflow can't be addressed through another
// workspace's routes.
func (h Handler) findWorkspaceWorkflow(c echo.Context) (model.Workflow, error) {
	workspaceId := c.Param("workspaceId")
	workflowId := c.Param("workflowId")

	wf, err := h.db.FindWorkflow(model.Workflow{ID: workflowId})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.Workflow{}, echo.NewHTTPError(http.StatusNotFound, "workflow not found")
		}
		return model.Workflow{}, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if wf.WorkspaceID != workspaceId {
		return model.Workflow{}, echo.NewHTTPError(http.StatusNotFound, "workflow not found")
	}
	return wf, nil
}

func (h Handler) GetWorkflows(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	workflows, err := h.db.FindWorkflows(model.WorkflowFilter{WorkspaceID: workspaceId})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if workflows == nil {
		workflows = []model.Workflow{}
	}

	return c.JSON(http.StatusOK, workflows)
}

func (h Handler) GetWorkflow(c echo.Context) error {
	wf, err := h.findWorkspaceWorkflow(c)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, wf)
}

func (h Handler) CreateWorkflow(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	var req CreateWorkflowRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	if _, validationErrs := workflow.ParseAndValidate(req.Definition); len(validationErrs) > 0 {
		return c.JSON(http.StatusUnprocessableEntity, map[string]interface{}{
			"errors": validationErrs,
		})
	}

	user := c.Get("user").(model.User)
	now := time.Now().UTC().Format(time.RFC3339)

	wf := model.Workflow{
		ID:          util.NewId(),
		WorkspaceID: workspaceId,
		Name:        req.Name,
		Definition:  req.Definition,
		Enabled:     true,
		CreatedAt:   now,
		CreatedBy:   user.ID,
		UpdatedAt:   now,
		UpdatedBy:   user.ID,
	}

	if err := h.db.CreateWorkflow(wf); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.notifyWorkflowsChanged()

	return c.JSON(http.StatusCreated, wf)
}

func (h Handler) UpdateWorkflow(c echo.Context) error {
	wf, err := h.findWorkspaceWorkflow(c)
	if err != nil {
		return err
	}

	var req UpdateWorkflowRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	if _, validationErrs := workflow.ParseAndValidate(req.Definition); len(validationErrs) > 0 {
		return c.JSON(http.StatusUnprocessableEntity, map[string]interface{}{
			"errors": validationErrs,
		})
	}

	user := c.Get("user").(model.User)
	wf.Name = req.Name
	wf.Definition = req.Definition
	wf.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	wf.UpdatedBy = user.ID

	if err := h.db.UpdateWorkflow(wf); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.notifyWorkflowsChanged()

	return c.JSON(http.StatusOK, wf)
}

func (h Handler) UpdateWorkflowEnabled(c echo.Context) error {
	wf, err := h.findWorkspaceWorkflow(c)
	if err != nil {
		return err
	}

	var req UpdateWorkflowEnabledRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	user := c.Get("user").(model.User)
	if err := h.db.UpdateWorkflowEnabled(wf.ID, *req.Enabled, time.Now().UTC().Format(time.RFC3339), user.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.notifyWorkflowsChanged()

	wf.Enabled = *req.Enabled
	return c.JSON(http.StatusOK, wf)
}

func (h Handler) DeleteWorkflow(c echo.Context) error {
	wf, err := h.findWorkspaceWorkflow(c)
	if err != nil {
		return err
	}

	if err := h.db.DeleteWorkflow(wf.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.notifyWorkflowsChanged()

	return c.NoContent(http.StatusNoContent)
}

func (h Handler) DispatchWorkflow(c echo.Context) error {
	wf, err := h.findWorkspaceWorkflow(c)
	if err != nil {
		return err
	}

	var req DispatchWorkflowRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if !wf.Enabled {
		return echo.NewHTTPError(http.StatusConflict, "workflow is disabled")
	}

	spec, validationErrs := workflow.ParseAndValidate(wf.Definition)
	if len(validationErrs) > 0 {
		return c.JSON(http.StatusUnprocessableEntity, map[string]interface{}{
			"errors": validationErrs,
		})
	}
	if !spec.HasWorkflowDispatch() {
		return echo.NewHTTPError(http.StatusBadRequest, "workflow does not declare a 'workflow_dispatch' trigger")
	}

	// Apply input defaults and check required inputs.
	inputs := map[string]string{}
	if spec.On.WorkflowDispatch.Inputs != nil {
		for name, def := range spec.On.WorkflowDispatch.Inputs {
			if v, ok := req.Inputs[name]; ok {
				inputs[name] = v
			} else if def.Default != "" {
				inputs[name] = def.Default
			} else if def.Required {
				return echo.NewHTTPError(http.StatusBadRequest, "missing required input: "+name)
			}
		}
	}

	user := c.Get("user").(model.User)

	workspace, err := h.db.FindWorkspaceByID(wf.WorkspaceID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	payload := workflow.EventPayload{
		Event:     model.WorkflowEventWorkflowDispatch,
		Workspace: workflow.PayloadWorkspace{ID: workspace.ID, Name: workspace.Name},
		Sender:    &workflow.PayloadSender{ID: user.ID, Name: user.Name},
		Inputs:    inputs,
	}

	run, err := workflow.CreateRun(h.db, wf, spec, model.WorkflowEventWorkflowDispatch, payload, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	h.notifyRunQueued()

	return c.JSON(http.StatusCreated, run)
}

// notifyWorkflowsChanged tells the trigger engine to reload schedules after a
// workflow definition changes. It is a no-op until the engine is wired in.
func (h Handler) notifyWorkflowsChanged() {
	if h.workflowEngine != nil {
		h.workflowEngine.ReloadSchedules()
	}
}

// notifyRunQueued wakes runners long-polling for work.
func (h Handler) notifyRunQueued() {
	if h.workflowEngine != nil {
		h.workflowEngine.WakeQueue()
	}
}

// notifyNoteEvent reports a note change to the trigger engine (no-op when no
// engine is attached).
func (h Handler) notifyNoteEvent(event string, note model.Note, actorID string) {
	if h.workflowEngine != nil {
		h.workflowEngine.NotifyNoteEvent(event, note, actorID)
	}
}
