package middlewares

import (
	"net/http"
	"strings"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/model"
)

const workspaceRoute = "/workspaces/:workspaceId"

// Routes the MCP server calls. A scoped key reaches nothing else, so a leaked
// token cannot touch admin, membership, workflow or deletion endpoints.
var (
	mcpReadRoutes = map[string]bool{
		"/oauth/tokeninfo":                               true,
		"/workspaces":                                    true,
		workspaceRoute:                                   true,
		workspaceRoute + "/notes":                        true,
		workspaceRoute + "/notes/:id":                    true,
		workspaceRoute + "/notes/:noteId/comments":       true,
		workspaceRoute + "/channels":                     true,
		workspaceRoute + "/channels/:channelId/messages": true,
	}
	mcpWriteRoutes = map[string]bool{
		workspaceRoute + "/notes":                        true,
		workspaceRoute + "/notes/:noteId/comments":       true,
		workspaceRoute + "/channels/:channelId/messages": true,
	}
)

// apiKeyScopeAllows reports whether a key with this scope may call a route,
// given as the route template echo matched.
func apiKeyScopeAllows(scope, method, routePath string) bool {
	route := strings.TrimPrefix(routePath, config.C.GetString(config.SERVER_API_ROOT_PATH))
	switch scope {
	case "":
		return true
	case model.ScopeMCPRead:
		return method == http.MethodGet && mcpReadRoutes[route]
	case model.ScopeMCPWrite:
		return (method == http.MethodGet && mcpReadRoutes[route]) ||
			(method == http.MethodPost && mcpWriteRoutes[route])
	default:
		return false
	}
}
