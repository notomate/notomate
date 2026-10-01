package route

import (
	"strings"

	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"
	"github.com/notomate/notomate/internal/model"

	"github.com/labstack/echo/v4"
)

func RegisterGoogleMaps(api *echo.Group, h handler.Handler, authMiddleware middlewares.AuthMiddleware, workspaceMiddleware middlewares.WorkspaceMiddleware) {
	g := api.Group("/workspaces")
	g.Use(middlewares.Skippable(authMiddleware.CheckJWT(), func(c echo.Context) bool {
		if strings.HasPrefix(c.Request().Header.Get("Authorization"), "Bearer ") {
			return true
		}
		// Place photos are shown on shared notes; GetGooglePlacePhoto limits
		// what anonymous requests can fetch.
		return strings.HasSuffix(c.Path(), "/google-maps/photos")
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

	g.GET("/:workspaceId/integrations/google-maps", h.GetGoogleMapsIntegration, member)
	g.PUT("/:workspaceId/integrations/google-maps", h.UpdateGoogleMapsIntegration, ownerOrAdmin)
	g.DELETE("/:workspaceId/integrations/google-maps", h.DeleteGoogleMapsIntegration, ownerOrAdmin)

	g.GET("/:workspaceId/google-maps/browser-key", h.GetGoogleMapsBrowserKey, member)
	g.POST("/:workspaceId/google-maps/places/search", h.SearchGooglePlaces, member)
	g.GET("/:workspaceId/google-maps/places/:placeId", h.GetGooglePlace, member)
	g.POST("/:workspaceId/google-maps/routes", h.ComputeGoogleRoutes, member)
	g.GET("/:workspaceId/google-maps/photos", h.GetGooglePlacePhoto)
}
