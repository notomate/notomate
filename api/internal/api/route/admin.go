package route

import (
	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"

	"github.com/labstack/echo/v4"
)

func RegisterAdmin(api *echo.Group, h handler.Handler, authMiddleware middlewares.AuthMiddleware) {
	g := api.Group("/admin")
	g.Use(authMiddleware.ParseJWT())
	g.Use(authMiddleware.RequireOwnerOrAdmin())
	g.GET("/users", h.ListUsers)
	g.POST("/users", h.CreateUser)
	g.PUT("/users/:id/password", h.UpdateUserPassword)
	g.PUT("/users/:id/role", h.UpdateUserRole)
	g.PUT("/users/:id/disable", h.DisableUser)
	g.PUT("/users/:id/enable", h.EnableUser)
	g.DELETE("/users/:id", h.DeleteUser)

	g.GET("/runners", h.ListRunners)
	g.DELETE("/runners/:id", h.DeleteRunner)
	g.GET("/runners/registration-token", h.GetRunnerRegistrationToken)
}
