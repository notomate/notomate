package middlewares

import (
	"net/http"
	"strings"
	"time"

	"github.com/notomate/notomate/internal/api/auth"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthMiddleware struct {
	db db.DB
}

func NewAuthMiddleware(db db.DB) *AuthMiddleware {
	return &AuthMiddleware{
		db: db,
	}
}

func (a AuthMiddleware) ParseJWT() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (returnErr error) {
			// STEP 1: Check for Authorization header with Bearer token (API Key)
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				apiKey := strings.TrimPrefix(authHeader, "Bearer ")

				// Validate API key format
				if !util.ValidateAPIKeyFormat(apiKey) {
					return echo.NewHTTPError(http.StatusUnauthorized, "invalid API key format")
				}

				// Extract prefix for lookup
				prefix := util.ExtractPrefix(apiKey)

				// Find API key by prefix
				apiKeyRecord, err := a.db.FindAPIKeyByPrefix(prefix)
				if err != nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "invalid API key")
				}

				// Check expiration
				if apiKeyRecord.ExpiresAt != "" {
					expiresAt, err := time.Parse(time.RFC3339, apiKeyRecord.ExpiresAt)
					if err == nil && time.Now().UTC().After(expiresAt) {
						return echo.NewHTTPError(http.StatusUnauthorized, "API key expired")
					}
				}

				// Verify full key with bcrypt (constant-time comparison)
				err = bcrypt.CompareHashAndPassword([]byte(apiKeyRecord.KeyHash), []byte(apiKey))
				if err != nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "invalid API key")
				}

				// Load user
				user, err := a.db.FindUserByID(apiKeyRecord.UserID)
				if err != nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "user not found")
				}

				// Check if user is disabled
				if user.Disabled {
					return echo.NewHTTPError(http.StatusUnauthorized, "user account disabled")
				}

				// Update last_used_at asynchronously (don't block request)
				go func() {
					apiKeyRecord.LastUsedAt = time.Now().UTC().Format(time.RFC3339)
					a.db.UpdateAPIKey(apiKeyRecord)
				}()

				// Set user in context
				c.Set("user", user)
				return next(c)
			}

			// STEP 2: Fall back to cookie-based JWT authentication
			cookie, err := c.Cookie("token")
			if err != nil || cookie.Value == "" {
				return next(c)
			}

			user, err := auth.GetUserFromCookie(cookie)
			if err != nil || user == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
			}

			// Load full user information from database including role
			fullUser, err := a.db.FindUserByID(user.ID)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "user not found")
			}

			// Check if user is disabled
			if fullUser.Disabled {
				return echo.NewHTTPError(http.StatusUnauthorized, "user account disabled")
			}

			c.Set("user", fullUser)

			return next(c)
		}
	}
}

func (a AuthMiddleware) CheckJWT() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (returnErr error) {
			cookie, err := c.Cookie("token")
			if err != nil || cookie.Value == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
			}
			return next(c)
		}
	}
}

func (a AuthMiddleware) RequireOwnerOrAdmin() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (returnErr error) {
			userInterface := c.Get("user")
			if userInterface == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "please login")
			}

			user, ok := userInterface.(model.User)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid user context")
			}

			if user.Role != "owner" && user.Role != "admin" {
				return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
			}

			return next(c)
		}
	}
}
