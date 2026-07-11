package handler

import (
	"net/http"
	"time"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
	"golang.org/x/crypto/bcrypt"

	"github.com/labstack/echo/v4"
)

type CreateUserRequest struct {
	Name     string
	Email    string
	Role     string
	Password string
}

type UpdateUserPasswordRequest struct {
	Password string
}
type UpdateUserRoleRequest struct {
	Role string
}

func (a Handler) ListUsers(c echo.Context) error {
	filter := model.UserFilter{}

	users, err := a.db.FindUsers(filter)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, users)
}

func (h Handler) CreateUser(c echo.Context) error {
	var user model.User
	if err := c.Bind(&user); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	var req CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if !model.IsValidRole(req.Role) || req.Role == model.RoleOwner {
		return echo.NewHTTPError(http.StatusBadRequest, "role is invalid")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to hash password")
	}

	user.ID = util.NewId()
	user.Name = req.Name
	user.Email = req.Email
	user.Role = req.Role
	user.AvatarUrl = ""
	user.PasswordHash = string(hashedPassword)
	user.CreatedAt = time.Now().UTC().String()
	user.CreatedBy = c.Get("user").(model.User).ID

	if err := h.db.CreateUser(user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, user)
}

func (h Handler) UpdateUserRole(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "user id is required")
	}

	var req UpdateUserRoleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if !model.IsValidRole(req.Role) || req.Role == model.RoleOwner {
		return echo.NewHTTPError(http.StatusBadRequest, "role is invalid")
	}

	user, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	if user.Role == model.RoleOwner {
		return c.JSON(http.StatusForbidden, "Cannot update owner.")
	}

	u := c.Get("user").(model.User)

	if u.Role == model.RoleAdmin && user.Role == model.RoleAdmin {
		return c.JSON(http.StatusForbidden, "Only the owner can update an administrator.")
	}

	user.Role = req.Role

	if err := h.db.UpdateUser(user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

func (h Handler) UpdateUserPassword(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "user id is required")
	}

	var req UpdateUserPasswordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	if user.Role == model.RoleOwner {
		return c.JSON(http.StatusForbidden, "Cannot update owner.")
	}

	u := c.Get("user").(model.User)

	if u.Role == model.RoleAdmin && user.Role == model.RoleAdmin {
		return c.JSON(http.StatusForbidden, "Only the owner can update an administrator.")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to hash password")
	}

	user.PasswordHash = string(hashedPassword)

	if err := h.db.UpdateUser(user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

func (h Handler) DisableUser(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "user id is required")
	}

	user, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	if user.Role == model.RoleOwner {
		return c.JSON(http.StatusForbidden, "Cannot update owner.")
	}

	u := c.Get("user").(model.User)

	if u.Role == model.RoleAdmin && user.Role == model.RoleAdmin {
		return c.JSON(http.StatusForbidden, "Only the owner can update an administrator.")
	}

	user.Disabled = true
	user.UpdatedBy = u.ID
	user.UpdatedAt = time.Now().UTC().String()

	if err := h.db.UpdateUserWithDisabled(user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

func (h Handler) EnableUser(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "user id is required")
	}

	user, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	if user.Role == model.RoleOwner {
		return c.JSON(http.StatusForbidden, "Cannot update owner.")
	}

	u := c.Get("user").(model.User)

	if u.Role == model.RoleAdmin && user.Role == model.RoleAdmin {
		return c.JSON(http.StatusForbidden, "Only the owner can update an administrator.")
	}

	user.Disabled = false
	user.UpdatedBy = u.ID
	user.UpdatedAt = time.Now().UTC().String()

	if err := h.db.UpdateUserWithDisabled(user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, user)
}
func (h Handler) DeleteUser(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "user id is required")
	}

	user, err := h.db.FindUserByID(id)
	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to get user by id")
	}

	if user.Role == model.RoleOwner {
		return c.JSON(http.StatusForbidden, "Cannot remove owner.")
	}

	u := c.Get("user").(model.User)

	if u.Role == model.RoleAdmin && user.Role == model.RoleAdmin {
		return c.JSON(http.StatusForbidden, "Only the owner can remove an administrator.")
	}

	if err := h.db.DeleteUser(id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusNoContent, "")
}
