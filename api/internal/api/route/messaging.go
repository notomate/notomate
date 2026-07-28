package route

import (
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
	g.Use(authMiddleware.CheckJWT())
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
