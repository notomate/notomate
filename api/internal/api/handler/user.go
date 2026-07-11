package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/notomate/notomate/internal/api/auth"
	"golang.org/x/crypto/bcrypt"
)

type ChangePasswordRequest struct {
	Password string
}

type UpdatePreferencesRequest struct {
	Preferences json.RawMessage `json:"preferences" validate:"required"`
}

func (h Handler) UpdatePreferences(c echo.Context) error {
	id := c.Param("id")
	cookie, err := c.Cookie("token")
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
	}

	user, err := auth.GetUserFromCookie(cookie)
	if err != nil || user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
	}

	if user.ID != id {
		return echo.NewHTTPError(http.StatusForbidden, "You do not have permission to update the preferences.")
	}

	var req UpdatePreferencesRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	u, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	u.Preferences = string(req.Preferences)
	u.UpdatedAt = time.Now().UTC().String()
	u.UpdatedBy = user.ID

	err = h.db.UpdateUser(u)

	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to update user")
	}

	return c.JSON(http.StatusOK, "Successfully updated preferences.")
}

func (h Handler) ChangePassword(c echo.Context) error {
	id := c.Param("id")

	var req ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "password is required")
	}

	cookie, err := c.Cookie("token")
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
	}

	user, err := auth.GetUserFromCookie(cookie)
	if err != nil || user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
	}

	if user.ID != id {
		return echo.NewHTTPError(http.StatusForbidden, "You do not have permission to update the preferences.")
	}

	u, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to hash password")
	}

	u.PasswordHash = string(hashedPassword)
	u.UpdatedAt = time.Now().UTC().String()
	u.UpdatedBy = user.ID

	err = h.db.UpdateUser(u)

	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to update user")
	}

	return c.JSON(http.StatusOK, "Successfully changed password.")
}
