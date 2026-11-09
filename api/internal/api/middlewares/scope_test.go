package middlewares

import (
	"net/http"
	"testing"

	"github.com/notomate/notomate/internal/config"
)

func TestAPIKeyScopeAllows(t *testing.T) {
	config.Init()
	const root = "/api/v1/workspaces/:workspaceId"

	cases := []struct {
		scope, method, path string
		want                bool
	}{
		{"", http.MethodDelete, root, true},
		{"", http.MethodGet, "/api/v1/admin/users", true},

		{"mcp:read", http.MethodGet, root + "/notes", true},
		{"mcp:read", http.MethodGet, "/api/v1/oauth/tokeninfo", true},
		{"mcp:read", http.MethodPost, root + "/notes", false},
		{"mcp:read", http.MethodGet, "/api/v1/admin/users", false},
		{"mcp:read", http.MethodGet, root + "/secrets", false},

		{"mcp:write", http.MethodGet, root + "/notes/:id", true},
		{"mcp:write", http.MethodPost, root + "/notes", true},
		{"mcp:write", http.MethodPost, root + "/notes/:noteId/comments", true},
		{"mcp:write", http.MethodPost, root + "/channels/:channelId/messages", true},
		{"mcp:write", http.MethodPut, root + "/notes/:id", false},
		{"mcp:write", http.MethodDelete, root + "/notes/:id", false},
		{"mcp:write", http.MethodPatch, root + "/notes/:id/visibility/:visibility", false},
		{"mcp:write", http.MethodPost, root + "/members", false},
		{"mcp:write", http.MethodDelete, root, false},

		{"something-else", http.MethodGet, root + "/notes", false},
	}
	for _, c := range cases {
		if got := apiKeyScopeAllows(c.scope, c.method, c.path); got != c.want {
			t.Errorf("apiKeyScopeAllows(%q, %s, %s) = %v, want %v", c.scope, c.method, c.path, got, c.want)
		}
	}
}
