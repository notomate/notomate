package route

import (
	"github.com/notomate/notomate/internal/api/handler"

	"github.com/labstack/echo/v4"
)

func RegisterAuth(g *echo.Group, h handler.Handler) {
	g.POST("/signin", h.SignIn)
	g.GET("/signout", h.SignOut)
	g.POST("/signup", h.SignUp)
	g.GET("/me", h.GetUserInfo)
	g.GET("/explore/notes", h.GetPublicNotes)
}
