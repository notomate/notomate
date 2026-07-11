package handler

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/notomate/notomate/internal/api/auth"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
	"golang.org/x/crypto/bcrypt"
)

type CreateAPIKeyRequest struct {
	Name      string `json:"name" validate:"required"`
	ExpiresAt string `json:"expires_at"` // Optional, RFC3339 format
}

// ListAPIKeys returns all API keys for a user (masked)
func (h Handler) ListAPIKeys(c echo.Context) error {
	userID := c.Param("id")

	// Get current user from context
	cookie, err := c.Cookie("token")
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
	}

	currentUser, err := auth.GetUserFromCookie(cookie)
	if err != nil || currentUser == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
	}

	// Users can only list their own API keys
	if currentUser.ID != userID {
		return echo.NewHTTPError(http.StatusForbidden, "you can only manage your own API keys")
	}

	// Find all keys for this user
	keys, err := h.db.FindAPIKeys(model.APIKeyFilter{UserID: userID})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch API keys")
	}

	// Convert to response format (masked)
	responses := make([]model.APIKeyResponse, len(keys))
	for i, key := range keys {
		responses[i] = model.APIKeyResponse{
			ID:         key.ID,
			UserID:     key.UserID,
			Name:       key.Name,
			Prefix:     key.Prefix,
			LastUsedAt: key.LastUsedAt,
			ExpiresAt:  key.ExpiresAt,
			CreatedAt:  key.CreatedAt,
		}
	}

	return c.JSON(http.StatusOK, responses)
}

// CreateAPIKey generates a new API key
func (h Handler) CreateAPIKey(c echo.Context) error {
	userID := c.Param("id")

	// Get current user from context
	cookie, err := c.Cookie("token")
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
	}

	currentUser, err := auth.GetUserFromCookie(cookie)
	if err != nil || currentUser == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
	}

	// Users can only create their own API keys
	if currentUser.ID != userID {
		return echo.NewHTTPError(http.StatusForbidden, "you can only manage your own API keys")
	}

	// Parse request
	var req CreateAPIKeyRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	// Validate expiration date if provided
	var expiresAt string
	if req.ExpiresAt != "" {
		parsedTime, err := time.Parse(time.RFC3339, req.ExpiresAt)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid expires_at format, use RFC3339")
		}
		if parsedTime.Before(time.Now().UTC()) {
			return echo.NewHTTPError(http.StatusBadRequest, "expires_at must be in the future")
		}
		expiresAt = parsedTime.UTC().Format(time.RFC3339)
	}

	// Generate API key
	fullKey, prefix, err := util.GenerateAPIKey()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate API key")
	}

	// Hash the full key with bcrypt (cost 12 for good security/performance balance)
	keyHash, err := bcrypt.GenerateFromPassword([]byte(fullKey), 12)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash API key")
	}

	// Create API key record
	apiKey := model.APIKey{
		ID:        util.NewId(),
		UserID:    userID,
		Name:      req.Name,
		KeyHash:   string(keyHash),
		Prefix:    prefix,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		CreatedBy: currentUser.ID,
	}

	// Save to database
	if err := h.db.CreateAPIKey(apiKey); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create API key")
	}

	// Return response with full key (ONLY TIME IT'S RETURNED)
	response := model.APIKeyCreationResponse{
		APIKeyResponse: model.APIKeyResponse{
			ID:        apiKey.ID,
			UserID:    apiKey.UserID,
			Name:      apiKey.Name,
			Prefix:    apiKey.Prefix,
			ExpiresAt: apiKey.ExpiresAt,
			CreatedAt: apiKey.CreatedAt,
		},
		FullKey: fullKey,
	}

	return c.JSON(http.StatusCreated, response)
}

// DeleteAPIKey removes an API key
func (h Handler) DeleteAPIKey(c echo.Context) error {
	userID := c.Param("id")
	keyID := c.Param("keyId")

	// Get current user from context
	cookie, err := c.Cookie("token")
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
	}

	currentUser, err := auth.GetUserFromCookie(cookie)
	if err != nil || currentUser == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
	}

	// Users can only delete their own API keys
	if currentUser.ID != userID {
		return echo.NewHTTPError(http.StatusForbidden, "you can only manage your own API keys")
	}

	// Verify the key belongs to the user
	apiKey, err := h.db.FindAPIKeyByID(keyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "API key not found")
	}

	if apiKey.UserID != userID {
		return echo.NewHTTPError(http.StatusForbidden, "this API key does not belong to you")
	}

	// Delete the key
	if err := h.db.DeleteAPIKey(keyID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete API key")
	}

	return c.NoContent(http.StatusNoContent)
}
