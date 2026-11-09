package route

import (
	"time"

	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

func RegisterOAuth(e *echo.Echo, api *echo.Group, h handler.Handler, authMiddleware middlewares.AuthMiddleware) {
	e.GET("/.well-known/oauth-authorization-server", h.OAuthMetadata)

	g := api.Group("/oauth")

	// Registration and token exchange are the only unauthenticated writes here.
	limit := middleware.RateLimiter(middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
		Rate:      rate.Limit(2),
		Burst:     30,
		ExpiresIn: 3 * time.Minute,
	}))
	g.POST("/register", h.OAuthRegister, limit)
	g.POST("/token", h.OAuthToken, limit)

	g.GET("/tokeninfo", h.OAuthTokenInfo, authMiddleware.ParseJWT())

	// Called by the consent page, so these need the signed-in session cookie.
	consent := g.Group("/authorize", authMiddleware.CheckJWT(), authMiddleware.ParseJWT())
	consent.GET("", h.OAuthAuthorizeInfo)
	consent.POST("", h.OAuthAuthorizeDecision)
}
