package handler

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
)

var (
	githubNamePattern = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,100}$`)
	gitRefPattern     = regexp.MustCompile(`^[A-Za-z0-9_./-]{1,255}$`)
)

type CreateActionSourceRequest struct {
	// Repo is "owner/repo"; a github.com URL is accepted too.
	Repo string `json:"repo" validate:"required"`
	Ref  string `json:"ref"`
}

type GitHubIntegrationResponse struct {
	Configured bool `json:"configured"`
}

type UpdateGitHubIntegrationRequest struct {
	Token string `json:"token"`
}

func (h Handler) GetActionSources(c echo.Context) error {
	sources, err := h.db.FindActionSources(c.Param("workspaceId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if sources == nil {
		sources = []model.ActionSource{}
	}
	return c.JSON(http.StatusOK, sources)
}

// CreateActionSource adds a repository and syncs it right away, so the
// response already says whether the repository could be read.
func (h Handler) CreateActionSource(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	var req CreateActionSourceRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}
	owner, repo, ok := parseRepoName(req.Repo)
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "repo must look like owner/repo")
	}
	ref := strings.TrimSpace(req.Ref)
	if !validGitRef(ref) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid ref")
	}

	user := c.Get("user").(model.User)
	now := time.Now().UTC().Format(time.RFC3339)
	src := model.ActionSource{
		ID:          util.NewId(),
		WorkspaceID: workspaceId,
		Owner:       owner,
		Repo:        repo,
		Ref:         ref,
		Status:      model.ActionSourceStatusPending,
		CreatedAt:   now,
		CreatedBy:   user.ID,
		UpdatedAt:   now,
		UpdatedBy:   user.ID,
	}
	if err := h.db.CreateActionSource(src); err != nil {
		if isUniqueConstraintErr(err) {
			return echo.NewHTTPError(http.StatusConflict, "this repository and ref are already added")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	synced, err := h.actionMarket.Sync(c.Request().Context(), src, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, synced)
}

func (h Handler) SyncActionSource(c echo.Context) error {
	src, err := h.findWorkspaceActionSource(c)
	if err != nil {
		return err
	}
	user := c.Get("user").(model.User)
	synced, err := h.actionMarket.Sync(c.Request().Context(), src, user.ID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, synced)
}

func (h Handler) DeleteActionSource(c echo.Context) error {
	src, err := h.findWorkspaceActionSource(c)
	if err != nil {
		return err
	}
	if err := h.db.DeleteActionSource(src.WorkspaceID, src.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

func (h Handler) GetMarketplaceActions(c echo.Context) error {
	actions, err := h.db.FindMarketplaceActions(c.Param("workspaceId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if actions == nil {
		actions = []model.MarketplaceAction{}
	}
	return c.JSON(http.StatusOK, actions)
}

// GetGitHubIntegration never returns the token itself.
func (h Handler) GetGitHubIntegration(c echo.Context) error {
	configured, err := h.actionMarket.HasToken(c.Param("workspaceId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, GitHubIntegrationResponse{Configured: configured})
}

func (h Handler) UpdateGitHubIntegration(c echo.Context) error {
	var req UpdateGitHubIntegrationRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "token is required")
	}
	user := c.Get("user").(model.User)
	if err := h.actionMarket.SaveToken(c.Param("workspaceId"), user.ID, token); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, GitHubIntegrationResponse{Configured: true})
}

func (h Handler) DeleteGitHubIntegration(c echo.Context) error {
	if err := h.actionMarket.DeleteToken(c.Param("workspaceId")); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// findWorkspaceActionSource scopes the lookup to the URL's workspace, so a
// source from another workspace reads as not found.
func (h Handler) findWorkspaceActionSource(c echo.Context) (model.ActionSource, error) {
	src, err := h.db.FindActionSource(c.Param("workspaceId"), c.Param("sourceId"))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return src, echo.NewHTTPError(http.StatusNotFound, "action source not found")
	}
	if err != nil {
		return src, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return src, nil
}

// parseRepoName accepts "owner/repo", "github.com/owner/repo" or an https
// URL, with an optional ".git" suffix.
func parseRepoName(s string) (string, string, bool) {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "https://")
	s = strings.TrimPrefix(s, "http://")
	s = strings.TrimPrefix(s, "github.com/")
	s = strings.TrimSuffix(strings.TrimSuffix(s, "/"), ".git")
	parts := strings.Split(s, "/")
	if len(parts) != 2 || !validGitHubName(parts[0]) || !validGitHubName(parts[1]) {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// validGitHubName rejects "." and ".." so a name can't walk the API path.
func validGitHubName(s string) bool {
	return githubNamePattern.MatchString(s) && strings.Trim(s, ".") != ""
}

// validGitRef accepts an empty ref (the default branch) or a branch, tag or
// SHA without path traversal.
func validGitRef(ref string) bool {
	if ref == "" {
		return true
	}
	return gitRefPattern.MatchString(ref) && !strings.Contains(ref, "..") &&
		!strings.HasPrefix(ref, "/") && !strings.HasSuffix(ref, "/")
}
