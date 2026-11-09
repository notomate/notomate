package handler

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"
)

func TestValidRedirectURI(t *testing.T) {
	cases := map[string]bool{
		"https://claude.ai/api/mcp/auth_callback": true,
		"http://localhost:53682/callback":         true,
		"http://127.0.0.1:8000/cb":                true,
		"http://[::1]:8000/cb":                    true,
		"http://example.com/cb":                   false,
		"http://localhost.example.com/cb":         false,
		"javascript:alert(1)":                     false,
		"myapp://callback":                        false,
		"https://example.com/cb#frag":             false,
		"https://user@example.com/cb":             false,
		"":                                        false,
		"https://example.com/" + strings.Repeat("a", oauthMaxRedirectLength): false,
	}
	for uri, want := range cases {
		if got := validRedirectURI(uri); got != want {
			t.Errorf("validRedirectURI(%q) = %v, want %v", uri, got, want)
		}
	}
}

func TestRedirectURIMatches(t *testing.T) {
	cases := []struct {
		registered, requested string
		want                  bool
	}{
		{"https://claude.ai/cb", "https://claude.ai/cb", true},
		{"https://claude.ai/cb", "https://claude.ai/other", false},
		{"https://claude.ai:443/cb", "https://claude.ai:8443/cb", false},
		{"http://localhost:1111/cb", "http://localhost:2222/cb", true},
		{"http://localhost:1111/cb", "http://localhost:2222/other", false},
		{"http://localhost:1111/cb", "http://127.0.0.1:1111/cb", false},
		{"http://localhost:1111/cb", "http://evil.example:1111/cb", false},
	}
	for _, c := range cases {
		if got := redirectURIMatches(c.registered, c.requested); got != c.want {
			t.Errorf("redirectURIMatches(%q, %q) = %v, want %v", c.registered, c.requested, got, c.want)
		}
	}
}

func TestMaxGrantableScope(t *testing.T) {
	cases := []struct {
		requested, want string
		ok              bool
	}{
		{"", "mcp:write", true},
		{"mcp:read", "mcp:read", true},
		{"mcp:write", "mcp:write", true},
		{"mcp:read mcp:write", "mcp:write", true},
		{"mcp:write mcp:read", "mcp:write", true},
		{"admin", "", false},
		{"mcp:read admin", "", false},
	}
	for _, c := range cases {
		got, ok := maxGrantableScope(c.requested)
		if got != c.want || ok != c.ok {
			t.Errorf("maxGrantableScope(%q) = %q, %v, want %q, %v", c.requested, got, ok, c.want, c.ok)
		}
	}
}

func TestVerifyPKCE(t *testing.T) {
	verifier := strings.Repeat("v", 43)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	if !verifyPKCE(challenge, verifier) {
		t.Error("matching verifier was rejected")
	}
	if verifyPKCE(challenge, strings.Repeat("w", 43)) {
		t.Error("wrong verifier was accepted")
	}
	if verifyPKCE(verifier, verifier) {
		t.Error("plain challenge was accepted")
	}
	if verifyPKCE(challenge, "short") {
		t.Error("too-short verifier was accepted")
	}
}
