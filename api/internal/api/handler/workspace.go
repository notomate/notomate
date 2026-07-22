package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"

	"github.com/labstack/echo/v4"
)

type CreateWorkspaceRequest struct {
	Name string `json:"name" validate:"required"`
}

type UpdateWorkspaceRequest struct {
	Name string `json:"name" validate:"required"`
}

func (h Handler) GetWorkspaces(c echo.Context) error {
	user := c.Get("user").(model.User)

	db, err := h.db.Begin(context.Background())
	defer db.Rollback()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	f := model.WorkspaceUserFilter{
		UserID: user.ID,
	}

	workspaceUsers, err := db.FindWorkspaceUsers(f)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if len(workspaceUsers) == 0 {
		return c.JSON(http.StatusOK, []model.Workspace{})
	}

	var workspaceIDs []string
	for _, wu := range workspaceUsers {
		workspaceIDs = append(workspaceIDs, wu.WorkspaceID)
	}

	workspaces, err := db.FindWorkspaces(model.WorkspaceFilter{WorkspaceIDs: workspaceIDs})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := db.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, workspaces)
}

func (h Handler) GetWorkspace(c echo.Context) error {
	id := c.Param("workspaceId")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}

	workspace, err := h.db.FindWorkspaceByID(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, workspace)
}

func (h Handler) CreateWorkspace(c echo.Context) error {
	var req CreateWorkspaceRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	user := c.Get("user").(model.User)

	workspace := model.Workspace{
		ID:        util.NewId(),
		Name:      req.Name,
		CreatedAt: time.Now().UTC().String(),
		CreatedBy: user.ID,
	}

	db, err := h.db.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := db.CreateWorkspace(workspace); err != nil {
		db.Rollback()
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	wu := model.WorkspaceUser{
		WorkspaceID: workspace.ID,
		UserID:      user.ID,
		Role:        model.WorkspaceUserRoleOwner,
		CreatedAt:   time.Now().UTC().String(),
		CreatedBy:   user.ID,
	}

	if err := db.CreateWorkspaceUser(wu); err != nil {
		db.Rollback()
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	err = db.Commit()

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	w, err := h.db.FindWorkspaceByID(workspace.ID)

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, w)
}

func (h Handler) DeleteWorkspace(c echo.Context) error {
	id := c.Param("workspaceId")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}

	db, err := h.db.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer db.Rollback()

	users, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{WorkspaceID: id})

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	user := c.Get("user").(model.User)
	var member model.WorkspaceUser

	for _, m := range users {
		if m.UserID == user.ID {
			member = m
		}
	}

	if member.UserID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Workspace member could not be found")
	}

	if member.Role != model.WorkspaceUserRoleOwner {
		return echo.NewHTTPError(http.StatusForbidden, "Only the workspace owner can delete the workspace.")
	}

	if err := db.DeleteWorkspace(id); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := db.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (h Handler) UpdateWorkspace(c echo.Context) error {
	id := c.Param("workspaceId")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}

	var req UpdateWorkspaceRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	db, err := h.db.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer db.Rollback()

	users, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{WorkspaceID: id})

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	user := c.Get("user").(model.User)
	var member model.WorkspaceUser

	for _, u := range users {
		if u.UserID == user.ID {
			member = u
		}
	}

	if member.UserID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace member not found")
	}

	if member.Role != model.WorkspaceUserRoleOwner {
		return echo.NewHTTPError(http.StatusForbidden, "Only the workspace owner can update the workspace.")
	}

	workspace := model.Workspace{
		ID:        id,
		Name:      req.Name,
		UpdatedBy: user.ID,
		UpdatedAt: time.Now().UTC().String(),
	}

	if err := db.UpdateWorkspace(workspace); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := db.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, workspace)
}

// Workspace Member Management

type WorkspaceMemberResponse struct {
	WorkspaceID   string `json:"workspace_id"`
	UserID        string `json:"user_id"`
	UserName      string `json:"user_name"`
	UserEmail     string `json:"user_email"`
	UserAvatarUrl string `json:"user_avatar_url"`
	Role          string `json:"role"`
	CreatedAt     string `json:"created_at"`
}

type InviteMemberRequest struct {
	Email string `json:"email" validate:"required,email"`
	Role  string `json:"role" validate:"required"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role" validate:"required"`
}

func (h Handler) GetWorkspaceMembers(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}

	db, err := h.db.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer db.Rollback()

	workspaceUsers, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{WorkspaceID: workspaceId})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var members []WorkspaceMemberResponse
	for _, wu := range workspaceUsers {
		user, err := db.FindUserByID(wu.UserID)
		if err != nil {
			continue
		}

		members = append(members, WorkspaceMemberResponse{
			WorkspaceID:   wu.WorkspaceID,
			UserID:        wu.UserID,
			UserName:      user.Name,
			UserEmail:     user.Email,
			UserAvatarUrl: user.AvatarUrl,
			Role:          wu.Role,
			CreatedAt:     wu.CreatedAt,
		})
	}

	if err := db.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, members)
}

func (h Handler) InviteMember(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id is required")
	}

	var req InviteMemberRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	// Validate role
	if !model.IsValidWorkspaceUserRole(req.Role) {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid role")
	}

	currentUser := c.Get("user").(model.User)

	db, err := h.db.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer db.Rollback()

	// Check if current user is owner or admin
	currentMember, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{
		WorkspaceID: workspaceId,
		UserID:      currentUser.ID,
	})
	if err != nil || len(currentMember) == 0 {
		return echo.NewHTTPError(http.StatusForbidden, "You are not a member of this workspace")
	}

	if currentMember[0].Role != model.WorkspaceUserRoleOwner && currentMember[0].Role != model.WorkspaceUserRoleAdmin {
		return echo.NewHTTPError(http.StatusForbidden, "Only workspace owner or admin can invite members")
	}

	// Find user by email
	users, err := db.FindUsers(model.UserFilter{NameOrEmail: req.Email})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if len(users) == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "User not found with this email")
	}

	invitedUser := users[0]

	// Check if user is already a member
	existingMembers, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{
		WorkspaceID: workspaceId,
		UserID:      invitedUser.ID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if len(existingMembers) > 0 {
		return echo.NewHTTPError(http.StatusConflict, "User is already a member of this workspace")
	}

	// Create workspace user
	workspaceUser := model.WorkspaceUser{
		WorkspaceID: workspaceId,
		UserID:      invitedUser.ID,
		Role:        req.Role,
		CreatedAt:   time.Now().UTC().String(),
		CreatedBy:   currentUser.ID,
	}

	if err := db.CreateWorkspaceUser(workspaceUser); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := db.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, WorkspaceMemberResponse{
		WorkspaceID:   workspaceUser.WorkspaceID,
		UserID:        workspaceUser.UserID,
		UserName:      invitedUser.Name,
		UserEmail:     invitedUser.Email,
		UserAvatarUrl: invitedUser.AvatarUrl,
		Role:          workspaceUser.Role,
		CreatedAt:     workspaceUser.CreatedAt,
	})
}

func (h Handler) UpdateMemberRole(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	userId := c.Param("userId")
	if workspaceId == "" || userId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id and user id are required")
	}

	var req UpdateMemberRoleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := c.Validate(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validation failed: " + err.Error(),
		})
	}

	// Validate role
	if !model.IsValidWorkspaceUserRole(req.Role) {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid role")
	}

	currentUser := c.Get("user").(model.User)

	db, err := h.db.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer db.Rollback()

	// Check if current user is owner or admin
	currentMembers, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{
		WorkspaceID: workspaceId,
		UserID:      currentUser.ID,
	})
	if err != nil || len(currentMembers) == 0 {
		return echo.NewHTTPError(http.StatusForbidden, "You are not a member of this workspace")
	}

	currentMember := currentMembers[0]
	if currentMember.Role != model.WorkspaceUserRoleOwner && currentMember.Role != model.WorkspaceUserRoleAdmin {
		return echo.NewHTTPError(http.StatusForbidden, "Only workspace owner or admin can update member roles")
	}

	// Get target member
	targetMembers, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{
		WorkspaceID: workspaceId,
		UserID:      userId,
	})
	if err != nil || len(targetMembers) == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Member not found")
	}

	targetMember := targetMembers[0]

	// Prevent changing owner role
	if targetMember.Role == model.WorkspaceUserRoleOwner {
		return echo.NewHTTPError(http.StatusForbidden, "Cannot change workspace owner's role")
	}

	// Only owner can change admin role
	if targetMember.Role == model.WorkspaceUserRoleAdmin && currentMember.Role != model.WorkspaceUserRoleOwner {
		return echo.NewHTTPError(http.StatusForbidden, "Only workspace owner can change admin's role")
	}

	// Update role
	targetMember.Role = req.Role
	targetMember.UpdatedBy = currentUser.ID
	targetMember.UpdatedAt = time.Now().UTC().String()

	if err := db.UpdateWorkspaceUser(targetMember); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	// Get updated user info
	user, err := db.FindUserByID(userId)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := db.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, WorkspaceMemberResponse{
		WorkspaceID:   targetMember.WorkspaceID,
		UserID:        targetMember.UserID,
		UserName:      user.Name,
		UserEmail:     user.Email,
		UserAvatarUrl: user.AvatarUrl,
		Role:          targetMember.Role,
		CreatedAt:     targetMember.CreatedAt,
	})
}

func (h Handler) RemoveMember(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	userId := c.Param("userId")
	if workspaceId == "" || userId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "workspace id and user id are required")
	}

	currentUser := c.Get("user").(model.User)

	db, err := h.db.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer db.Rollback()

	// Get current user's membership
	currentMembers, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{
		WorkspaceID: workspaceId,
		UserID:      currentUser.ID,
	})
	if err != nil || len(currentMembers) == 0 {
		return echo.NewHTTPError(http.StatusForbidden, "You are not a member of this workspace")
	}

	currentMember := currentMembers[0]

	// Get target member
	targetMembers, err := db.FindWorkspaceUsers(model.WorkspaceUserFilter{
		WorkspaceID: workspaceId,
		UserID:      userId,
	})
	if err != nil || len(targetMembers) == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Member not found")
	}

	targetMember := targetMembers[0]

	// Owner cannot leave
	if targetMember.Role == model.WorkspaceUserRoleOwner {
		return echo.NewHTTPError(http.StatusForbidden, "Workspace owner cannot leave. Please delete the workspace or transfer ownership first")
	}

	// Check permissions
	isSelf := currentUser.ID == userId
	isOwnerOrAdmin := currentMember.Role == model.WorkspaceUserRoleOwner || currentMember.Role == model.WorkspaceUserRoleAdmin

	// Can remove if: 1) removing self (and not owner), or 2) is owner/admin
	if !isSelf && !isOwnerOrAdmin {
		return echo.NewHTTPError(http.StatusForbidden, "You don't have permission to remove this member")
	}

	// Admin cannot remove another admin unless they are owner
	if !isSelf && targetMember.Role == model.WorkspaceUserRoleAdmin && currentMember.Role != model.WorkspaceUserRoleOwner {
		return echo.NewHTTPError(http.StatusForbidden, "Only workspace owner can remove an admin")
	}

	if err := db.DeleteWorkspaceUser(targetMember); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := db.Commit(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
