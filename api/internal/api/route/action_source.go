package route

import (
	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"
	"github.com/notomate/notomate/internal/model"

	"github.com/labstack/echo/v4"
)

func RegisterActionMarketplace(api *echo.Group, h handler.Handler, authMiddleware middlewares.AuthMiddleware, workspaceMiddleware middlewares.WorkspaceMiddleware) {
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

	g.GET("/:workspaceId/action-sources", h.GetActionSources, member)
	g.POST("/:workspaceId/action-sources", h.CreateActionSource, ownerOrAdmin)
	g.POST("/:workspaceId/action-sources/:sourceId/sync", h.SyncActionSource, ownerOrAdmin)
	g.DELETE("/:workspaceId/action-sources/:sourceId", h.DeleteActionSource, ownerOrAdmin)
	g.GET("/:workspaceId/marketplace/actions", h.GetMarketplaceActions, member)

	g.GET("/:workspaceId/integrations/github", h.GetGitHubIntegration, member)
	g.PUT("/:workspaceId/integrations/github", h.UpdateGitHubIntegration, ownerOrAdmin)
	g.DELETE("/:workspaceId/integrations/github", h.DeleteGitHubIntegration, ownerOrAdmin)
}
