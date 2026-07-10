package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/collabreef/collabreef/internal/model"
	"github.com/collabreef/collabreef/internal/workflow"
)

// runnerOnlineWindow is how recently a runner must have polled to be shown
// as online (runners long-poll at least every 30s).
const runnerOnlineWindow = 2 * time.Minute

type RunnerResponse struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Labels       []string `json:"labels"`
	Version      string   `json:"version"`
	Status       string   `json:"status"`
	LastOnlineAt string   `json:"last_online_at"`
	CreatedAt    string   `json:"created_at"`
}

func (h Handler) ListRunners(c echo.Context) error {
	runners, err := h.db.FindRunners(model.RunnerFilter{})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	res := make([]RunnerResponse, 0, len(runners))
	for _, r := range runners {
		var labels []string
		_ = json.Unmarshal([]byte(r.Labels), &labels)

		status := model.RunnerStatusOffline
		if t, err := time.Parse(time.RFC3339, r.LastOnlineAt); err == nil && time.Since(t) < runnerOnlineWindow {
			status = model.RunnerStatusOnline
		}

		res = append(res, RunnerResponse{
			ID:           r.ID,
			Name:         r.Name,
			Labels:       labels,
			Version:      r.Version,
			Status:       status,
			LastOnlineAt: r.LastOnlineAt,
			CreatedAt:    r.CreatedAt,
		})
	}

	return c.JSON(http.StatusOK, res)
}

func (h Handler) DeleteRunner(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "runner id is required")
	}

	if err := h.db.DeleteRunner(id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h Handler) GetRunnerRegistrationToken(c echo.Context) error {
	token, err := workflow.EnsureRegistrationToken(h.db)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"registration_token": token})
}
