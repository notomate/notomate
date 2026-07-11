package server

import (
	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/notomate/notomate/internal/api/handler"
	"github.com/notomate/notomate/internal/api/middlewares"
	"github.com/notomate/notomate/internal/api/route"
	"github.com/notomate/notomate/internal/api/validate"
	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/storage"
	"github.com/notomate/notomate/internal/workflow"
)

func New(db db.DB, storage storage.Storage, engine *workflow.Engine) (*echo.Echo, error) {
	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Validator = &validate.CustomValidator{Validator: validator.New()}

	apiRoot := config.C.GetString(config.SERVER_API_ROOT_PATH)

	handler := handler.NewHandler(db, storage)
	if engine != nil {
		// Must happen before route registration: routes capture a copy of
		// the handler value.
		handler.SetWorkflowEngine(engine)
	}
	auth := middlewares.NewAuthMiddleware(db)
	workspace := middlewares.NewWorkspaceMiddleware(db)

	// Register REST API routes under /api/v1
	api := e.Group(apiRoot)
	route.RegisterAuth(api, *handler)
	route.RegisterAdmin(api, *handler, *auth)
	route.RegisterUser(api, *handler, *auth)
	route.RegisterWorkspace(api, *handler, *auth, *workspace)
	route.RegisterWorkflow(api, *handler, *auth, *workspace)

	return e, nil
}
