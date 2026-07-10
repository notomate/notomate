package route

import (
	"github.com/collabreef/collabreef/internal/api/handler"
	"github.com/collabreef/collabreef/internal/api/middlewares"
	"github.com/collabreef/collabreef/internal/model"

	"github.com/labstack/echo/v4"
)

func RegisterWorkflow(api *echo.Group, h handler.Handler, authMiddleware middlewares.AuthMiddleware, workspaceMiddleware middlewares.WorkspaceMiddleware) {
	g := api.Group("/workspaces")
	g.Use(authMiddleware.CheckJWT())
	g.Use(authMiddleware.ParseJWT())
	g.Use(workspaceMiddleware.CheckWorkspaceExists())

	member := workspaceMiddleware.RequireWorkspaceRole(
		model.WorkspaceUserRoleOwner,
		model.WorkspaceUserRoleAdmin,
		model.WorkspaceUserRoleUser,
	)
	ownerOrAdmin := workspaceMiddleware.RequireWorkspaceRole(
		model.WorkspaceUserRoleOwner,
		model.WorkspaceUserRoleAdmin,
	)

	g.GET("/:workspaceId/workflows", h.GetWorkflows, member)
	g.POST("/:workspaceId/workflows", h.CreateWorkflow, ownerOrAdmin)
	g.GET("/:workspaceId/workflows/:workflowId", h.GetWorkflow, member)
	g.PUT("/:workspaceId/workflows/:workflowId", h.UpdateWorkflow, ownerOrAdmin)
	g.DELETE("/:workspaceId/workflows/:workflowId", h.DeleteWorkflow, ownerOrAdmin)
	g.PATCH("/:workspaceId/workflows/:workflowId/enabled", h.UpdateWorkflowEnabled, ownerOrAdmin)
	g.POST("/:workspaceId/workflows/:workflowId/dispatch", h.DispatchWorkflow, ownerOrAdmin)

	g.GET("/:workspaceId/workflows/:workflowId/runs", h.GetWorkflowRuns, member)
	g.GET("/:workspaceId/runs/:runId", h.GetWorkflowRun, member)
	g.GET("/:workspaceId/runs/:runId/jobs/:jobId/logs", h.GetWorkflowJobLogs, member)
	g.POST("/:workspaceId/runs/:runId/cancel", h.CancelWorkflowRun, ownerOrAdmin)
}
