package handler

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/workflow"
)

type WorkflowRunDetailResponse struct {
	model.WorkflowRun
	Jobs []model.WorkflowJob `json:"jobs"`
}

type WorkflowJobLogsResponse struct {
	Lines    []model.WorkflowJobLog `json:"lines"`
	Next     int                    `json:"next"`
	Finished bool                   `json:"finished"`
}

// findWorkspaceWorkflowRun loads a run and verifies it belongs to the
// workspace in the URL.
func (h Handler) findWorkspaceWorkflowRun(c echo.Context) (model.WorkflowRun, error) {
	workspaceId := c.Param("workspaceId")
	runId := c.Param("runId")

	run, err := h.db.FindWorkflowRun(model.WorkflowRun{ID: runId})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.WorkflowRun{}, echo.NewHTTPError(http.StatusNotFound, "run not found")
		}
		return model.WorkflowRun{}, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if run.WorkspaceID != workspaceId {
		return model.WorkflowRun{}, echo.NewHTTPError(http.StatusNotFound, "run not found")
	}
	return run, nil
}

func (h Handler) GetWorkflowRuns(c echo.Context) error {
	wf, err := h.findWorkspaceWorkflow(c)
	if err != nil {
		return err
	}

	pageSize, _ := strconv.Atoi(c.QueryParam("page_size"))
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 30
	}
	pageNumber, _ := strconv.Atoi(c.QueryParam("page"))
	if pageNumber <= 0 {
		pageNumber = 1
	}

	runs, err := h.db.FindWorkflowRuns(model.WorkflowRunFilter{
		WorkflowID: wf.ID,
		PageSize:   pageSize,
		PageNumber: pageNumber,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if runs == nil {
		runs = []model.WorkflowRun{}
	}

	return c.JSON(http.StatusOK, runs)
}

func (h Handler) GetWorkflowRun(c echo.Context) error {
	run, err := h.findWorkspaceWorkflowRun(c)
	if err != nil {
		return err
	}

	jobs, err := h.db.FindWorkflowJobs(model.WorkflowJobFilter{RunID: run.ID})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if jobs == nil {
		jobs = []model.WorkflowJob{}
	}

	return c.JSON(http.StatusOK, WorkflowRunDetailResponse{WorkflowRun: run, Jobs: jobs})
}

func (h Handler) CancelWorkflowRun(c echo.Context) error {
	run, err := h.findWorkspaceWorkflowRun(c)
	if err != nil {
		return err
	}

	if model.IsTerminalWorkflowRunStatus(run.Status) {
		return echo.NewHTTPError(http.StatusConflict, "run is already finished")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if err := workflow.CancelRun(h.db, run, now); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	run.Status = model.WorkflowRunStatusCancelled
	return c.JSON(http.StatusOK, run)
}

func (h Handler) GetWorkflowJobLogs(c echo.Context) error {
	run, err := h.findWorkspaceWorkflowRun(c)
	if err != nil {
		return err
	}

	jobId := c.Param("jobId")
	job, err := h.db.FindWorkflowJob(model.WorkflowJob{ID: jobId})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, "job not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if job.RunID != run.ID {
		return echo.NewHTTPError(http.StatusNotFound, "job not found")
	}

	after, _ := strconv.Atoi(c.QueryParam("after"))
	lines, err := h.db.FindWorkflowJobLogs(job.ID, after, 1000)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if lines == nil {
		lines = []model.WorkflowJobLog{}
	}

	next := after
	if len(lines) > 0 {
		next = lines[len(lines)-1].LineNo
	}

	return c.JSON(http.StatusOK, WorkflowJobLogsResponse{
		Lines:    lines,
		Next:     next,
		Finished: model.IsTerminalWorkflowRunStatus(job.Status),
	})
}
