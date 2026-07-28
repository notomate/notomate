package route

import (
	"strings"

	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"
	"github.com/notomate/notomate/internal/model"

	"github.com/labstack/echo/v4"
)

// RegisterMessaging wires up channels and channel messages. Channels are
// visible to every workspace member (there is no separate per-channel
// membership/visibility yet), so all routes just require workspace
// membership; only channel management is further restricted to
// owner/admin, mirroring RegisterWorkflow.
func RegisterMessaging(api *echo.Group, h handler.Handler, authMiddleware middlewares.AuthMiddleware, workspaceMiddleware middlewares.WorkspaceMiddleware) {
	g := api.Group("/workspaces")
	g.Use(middlewares.Skippable(authMiddleware.CheckJWT(), func(c echo.Context) bool {
		// Skip JWT cookie auth for API-key requests (Authorization: Bearer
		// ...) - ParseJWT below fully authenticates (and rejects) those on
		// its own. Mirrors RegisterWorkspace's Bearer bypass, without which
		// personal API keys (e.g. used by workflow actions) get a 401 here
		// before ParseJWT ever sees them.
		return strings.HasPrefix(c.Request().Header.Get("Authorization"), "Bearer ")
	}))
	g.Use(authMiddleware.ParseJWT())
	g.Use(workspaceMiddleware.CheckWorkspaceExists())

	member := workspaceMiddleware.RequireWorkspaceRole(
		model.WorkspaceUserRoleOwner,
		model.WorkspaceUserRoleAdmin,
		model.WorkspaceUserRoleUser,
	)
	ownerOrAdmin := workspaceMiddleware.RequireWorkspaceRole(
		model.WorkspaceUserRoleOwner,
		model.WorkspaceUserRoleAdmin,
	)

	g.GET("/:workspaceId/channels", h.GetChannels, member)
	g.POST("/:workspaceId/channels", h.CreateChannel, member)
	g.PUT("/:workspaceId/channels/:channelId", h.UpdateChannel, ownerOrAdmin)
	g.DELETE("/:workspaceId/channels/:channelId", h.DeleteChannel, ownerOrAdmin)

	g.GET("/:workspaceId/channels/:channelId/messages", h.GetChannelMessages, member)
	g.POST("/:workspaceId/channels/:channelId/messages", h.CreateMessage, member)
	g.PUT("/:workspaceId/channels/:channelId/messages/:id", h.UpdateMessage, member)
	g.DELETE("/:workspaceId/channels/:channelId/messages/:id", h.DeleteMessage, member)
}
