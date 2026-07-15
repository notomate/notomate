package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/notomate/notomate/internal/api/auth"
	"github.com/notomate/notomate/internal/model"
	"golang.org/x/crypto/bcrypt"
)

var allowedAvatarExts = map[string]struct{}{
	".jpg":  {},
	".jpeg": {},
	".png":  {},
	".gif":  {},
	".webp": {},
}

const maxAvatarSize = 5 * 1024 * 1024 // 5MB

type ChangePasswordRequest struct {
	Password string
}

type UpdatePreferencesRequest struct {
	Preferences json.RawMessage `json:"preferences" validate:"required"`
}

type ChangeEmailRequest struct {
	Email string `json:"email" validate:"required,email"`
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

func (h Handler) ChangeEmail(c echo.Context) error {
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
		return echo.NewHTTPError(http.StatusForbidden, "You do not have permission to update this user's email.")
	}

	var req ChangeEmailRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Validation failed: "+err.Error())
	}

	existing, err := h.db.FindUsers(model.UserFilter{Email: req.Email})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, "failed to check email availability")
	}
	for _, e := range existing {
		if e.ID != id {
			return echo.NewHTTPError(http.StatusConflict, "This email is already in use.")
		}
	}

	u, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	u.Email = req.Email
	u.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	u.UpdatedBy = user.ID

	if err := h.db.UpdateUser(u); err != nil {
		return c.JSON(http.StatusBadRequest, "failed to update user")
	}

	return c.JSON(http.StatusOK, echo.Map{"email": u.Email})
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

func (h Handler) UploadAvatar(c echo.Context) error {
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
		return echo.NewHTTPError(http.StatusForbidden, "You do not have permission to update this user's avatar.")
	}

	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "file is required")
	}

	if file.Size > maxAvatarSize {
		return echo.NewHTTPError(http.StatusBadRequest, "avatar file is too large (max 5MB)")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if _, ok := allowedAvatarExts[ext]; !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "unsupported image type")
	}

	f, err := file.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to read uploaded file")
	}
	defer f.Close()

	newFileName := id + "_" + time.Now().Format("20060102150405") + "_" + randStringRunes(4) + ext

	if err := h.storage.Save([]string{"avatars", newFileName}, f); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save avatar")
	}

	u, err := h.db.FindUserByID(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "failed to get user by id")
	}

	u.AvatarUrl = "/api/v1/avatars/" + newFileName
	u.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	u.UpdatedBy = user.ID

	if err := h.db.UpdateUser(u); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update user")
	}

	return c.JSON(http.StatusOK, echo.Map{"avatar_url": u.AvatarUrl})
}

func (h Handler) RemoveAvatar(c echo.Context) error {
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
		return echo.NewHTTPError(http.StatusForbidden, "You do not have permission to update this user's avatar.")
	}

	u, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	if filename, ok := strings.CutPrefix(u.AvatarUrl, "/api/v1/avatars/"); ok {
		_ = h.storage.Delete([]string{"avatars", filename})
	}

	u.AvatarUrl = ""
	u.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	u.UpdatedBy = user.ID

	if err := h.db.UpdateUserAvatar(u); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update user")
	}

	return c.JSON(http.StatusOK, echo.Map{"avatar_url": ""})
}

func (h Handler) DownloadAvatar(c echo.Context) error {
	filename := c.Param("filename")
	if filename == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "filename is required")
	}

	f, err := h.storage.Load([]string{"avatars", filename})
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "avatar not found")
	}
	defer f.Close()

	http.ServeContent(c.Response(), c.Request(), filename, time.Time{}, f)
	return nil
}
