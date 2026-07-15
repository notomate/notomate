package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/notomate/notomate/internal/api/auth"
	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type SignInRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type SignInResponse struct {
	Username string `json:"username"`
	Message  string `json:"message"`
}

type SignOutResponse struct {
	Message string `json:"message"`
}

type SignUpRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	Username string `json:"username" validate:"required,min=3"`
}

type SignUpResponse struct {
	UserID  string `json:"user_id"`
	Message string `json:"message"`
}

type GetUserInfoResponse struct {
	ID          string          `json:"id"`
	Email       string          `json:"email"`
	Name        string          `json:"name"`
	Role        string          `json:"role"`
	AvatarUrl   string          `json:"avatar_url"`
	Disabled    bool            `json:"disabled"`
	CreatedBy   string          `json:"created_by"`
	CreatedAt   string          `json:"created_at"`
	UpdatedBy   string          `json:"updated_by"`
	UpdatedAt   string          `json:"updated_at"`
	Preferences json.RawMessage `json:"preferences"`
}

func (h *Handler) SignIn(c echo.Context) error {
	req := new(SignInRequest)

	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request data",
		})
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	users, err := h.db.FindUsers(model.UserFilter{Email: req.Email})

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	if len(users) == 0 {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "User not found",
		})
	}

	existingUser := users[0]

	if bcrypt.CompareHashAndPassword([]byte(existingUser.PasswordHash), []byte(req.Password)) != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Login failed",
		})
	}

	// Check if user account is disabled
	if existingUser.Disabled {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Account has been disabled",
		})
	}

	cookie, err := auth.CreateUserCookie(existingUser)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	c.SetCookie(cookie)

	resp := SignInResponse{
		Username: existingUser.Name,
		Message:  "Login successful",
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) SignOut(c echo.Context) error {
	cookie := auth.GetCleanCookie()

	c.SetCookie(cookie)

	resp := SignOutResponse{
		Message: "Successfully signed out",
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) SignUp(c echo.Context) error {
	disableSignUp := config.C.GetBool(config.APP_DISABLE_SIGNUP)

	if disableSignUp {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Registration is not allowed on this server.",
		})
	}

	req := new(SignUpRequest)

	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request data",
		})
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	users, err := h.db.FindUsers(model.UserFilter{})

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	for _, user := range users {
		if user.Email == req.Email {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "This email is already registered. Please use a different email.",
			})
		}

		if user.Name == req.Username {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "This username is taken. Please choose a different username.",
			})
		}
	}

	userCount := len(users)

	userID := util.NewId()
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "failed to hash password",
		})
	}

	user := model.User{
		ID:           userID,
		Name:         req.Username,
		Email:        req.Email,
		Role:         model.RoleUser,
		PasswordHash: string(hashedPassword),
		CreatedBy:    userID,
		CreatedAt:    time.Now().UTC().String(),
	}

	if userCount == 0 {
		user.Role = model.RoleOwner
	}

	err = h.db.CreateUser(user)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, err.Error())
	}

	cookie, err := auth.CreateUserCookie(user)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, err.Error())
	}

	c.SetCookie(cookie)

	resp := SignUpResponse{
		UserID:  userID,
		Message: "Sign-up successful",
	}

	return c.JSON(http.StatusCreated, resp)
}

func (h *Handler) GetUserInfo(c echo.Context) error {
	cookie, err := c.Cookie("token")
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
	}

	user, err := auth.GetUserFromCookie(cookie)
	if err != nil || user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
	}

	u, err := h.db.FindUserByID(user.ID)

	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "failed to get user by ID")
	}

	res := GetUserInfoResponse{
		ID:        u.ID,
		Name:      u.Name,
		Email:     u.Email,
		Role:      u.Role,
		AvatarUrl: u.AvatarUrl,
	}

	if u.Preferences != "" {
		res.Preferences = json.RawMessage(u.Preferences)
	}

	return c.JSON(http.StatusOK, res)
}
