package middlewares

import (
	"net/http"

	"github.com/collabreef/collabreef/internal/config"
	"github.com/collabreef/collabreef/internal/db"
	"github.com/collabreef/collabreef/internal/model"

	"github.com/labstack/echo/v4"
)

type WorkspaceMiddleware struct {
	db db.DB
}

func NewWorkspaceMiddleware(db db.DB) *WorkspaceMiddleware {
	return &WorkspaceMiddleware{
		db: db,
	}
}

func (m WorkspaceMiddleware) CheckWorkspaceExists() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (returnErr error) {

			apiRoot := config.C.GetString(config.SERVER_API_ROOT_PATH)
			if c.Path() == apiRoot+"/workspaces" {
				return next(c)
			}

			workspaceId := c.Param("workspaceId")

			w, err := m.db.FindWorkspaceByID(workspaceId)

			if err != nil || w.ID == "" {
				return c.JSON(http.StatusBadRequest, "failed to get workspace by id")
			}

			return next(c)
		}
	}
}

// RequireWorkspaceRole restricts a route to workspace members whose role is
// in the given list. This checks the per-workspace role from workspace_users,
// not the instance-level user role.
func (m WorkspaceMiddleware) RequireWorkspaceRole(roles ...string) echo.MiddlewareFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			workspaceId := c.Param("workspaceId")
			user, ok := c.Get("user").(model.User)
			if !ok {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "Authentication required",
				})
			}

			members, err := m.db.FindWorkspaceUsers(model.WorkspaceUserFilter{
				WorkspaceID: workspaceId,
				UserID:      user.ID,
			})
			if err != nil || len(members) == 0 {
				return c.JSON(http.StatusForbidden, map[string]string{
					"error": "Restricted to workspace members only",
				})
			}

			if _, ok := allowed[members[0].Role]; !ok {
				return c.JSON(http.StatusForbidden, map[string]string{
					"error": "Insufficient workspace role",
				})
			}

			return next(c)
		}
	}
}

func (m WorkspaceMiddleware) RestrictWorkspaceMember(config config.AppConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (returnErr error) {
			if c.Path() == config.Server.ApiRootPath+"/workspaces" {
				return next(c)
			}

			workspaceId := c.Param("workspaceId")

			users, err := m.db.FindWorkspaceUsers(model.WorkspaceUserFilter{WorkspaceID: workspaceId})

			if err != nil {
				return c.JSON(http.StatusBadRequest, "failed to get workspace by id")
			}

			isMember := false

			for _, u := range users {
				if u.UserID == c.Get("user").(model.User).ID {
					isMember = true
				}
			}

			if !isMember {
				return c.JSON(http.StatusForbidden, map[string]string{
					"error": "Restricted to workspace members only",
				})
			}

			return next(c)
		}
	}
}
