package route

import (
	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"
	"github.com/notomate/notomate/internal/model"

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

	g.GET("/:workspaceId/vars", h.GetWorkflowVars, ownerOrAdmin)
	g.POST("/:workspaceId/vars", h.CreateWorkflowVar, ownerOrAdmin)
	g.PUT("/:workspaceId/vars/:key", h.UpdateWorkflowVar, ownerOrAdmin)
	g.DELETE("/:workspaceId/vars/:key", h.DeleteWorkflowVar, ownerOrAdmin)

	g.GET("/:workspaceId/secrets", h.GetWorkflowSecrets, ownerOrAdmin)
	g.POST("/:workspaceId/secrets", h.CreateWorkflowSecret, ownerOrAdmin)
	g.PUT("/:workspaceId/secrets/:key", h.UpdateWorkflowSecret, ownerOrAdmin)
	g.DELETE("/:workspaceId/secrets/:key", h.DeleteWorkflowSecret, ownerOrAdmin)
}
