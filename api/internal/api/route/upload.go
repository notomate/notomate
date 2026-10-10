package route

import (
	"net/http"
	"strings"

	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"
	"github.com/notomate/notomate/internal/model"

	"github.com/labstack/echo/v4"
)

// RegisterUploads mounts the resumable (tus) upload endpoint at /uploads/.
// The workspace is passed in the upload metadata and checked on creation.
func RegisterUploads(api *echo.Group, uploads *handler.ResumableUploads, authMiddleware middlewares.AuthMiddleware) {
	g := api.Group("/uploads")
	g.Use(authMiddleware.CheckJWT())
	g.Use(authMiddleware.ParseJWT())
	g.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get("user").(model.User)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
			}
			req := c.Request()
			if id := strings.Trim(c.Param("*"), "/"); id != "" {
				if strings.ContainsAny(id, `/\.`) {
					return echo.NewHTTPError(http.StatusNotFound)
				}
				if err := uploads.Authorize(req.Context(), id, user); err != nil {
					return echo.NewHTTPError(http.StatusForbidden, err.Error())
				}
			}
			c.SetRequest(req.WithContext(handler.ContextWithUser(req.Context(), user)))
			return next(c)
		}
	})

	tus := echo.WrapHandler(uploads.Handler())
	g.Any("/*", tus)
}
