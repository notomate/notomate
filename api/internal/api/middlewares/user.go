package middlewares

import (
	"net/http"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"

	"github.com/labstack/echo/v4"
)

type UserMiddleware struct {
	db db.DB
}

func NewUserMiddleware(db db.DB) *UserMiddleware {
	return &UserMiddleware{
		db: db,
	}
}

func (a UserMiddleware) CheckUserId() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (returnErr error) {
			id := c.Param("id")
			user := c.Get("user").(model.User)

			if id != user.ID {
				return c.JSON(http.StatusBadRequest, "you do not have permission")
			}

			return next(c)
		}
	}
}
