package route

import (
	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"

	"github.com/labstack/echo/v4"
)

func RegisterUser(api *echo.Group, h handler.Handler, authMiddleware middlewares.AuthMiddleware) {
	// Publicly accessible so avatars can be rendered anywhere (e.g. Explore page for signed-out visitors).
	api.GET("/avatars/:filename", h.DownloadAvatar)

	g := api.Group("/users")
	g.Use(authMiddleware.CheckJWT())
	g.Use(authMiddleware.ParseJWT())
	g.PATCH("/:id/preferences", h.UpdatePreferences)
	g.POST("/:id/avatar", h.UploadAvatar)

	// API Key management routes
	apiKeys := g.Group("/:id/api-keys")
	apiKeys.GET("", h.ListAPIKeys)            // GET /api/v1/users/:id/api-keys
	apiKeys.POST("", h.CreateAPIKey)          // POST /api/v1/users/:id/api-keys
	apiKeys.DELETE("/:keyId", h.DeleteAPIKey) // DELETE /api/v1/users/:id/api-keys/:keyId
}
