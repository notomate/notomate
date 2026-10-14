package github

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

const rootAction = `name: Root action
description: Does root things
author: someone
branding:
  icon: zap
  color: blue
inputs:
  token:
    description: A token
    required: true
  level:
    description: Log level
    default: info
  old:
    deprecationMessage: use level
outputs:
  result:
    description: The result
runs:
  using: node20
  main: index.js
`

const nestedAction = `name: Nested
runs:
  using: composite
  steps: []
`

type fakeGitHub struct {
	token     string
	files     map[string]string // path -> content
	truncated bool
	mu        sync.Mutex
	requests  []string
}

func (f *fakeGitHub) handler(t *testing.T) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.requests = append(f.requests, r.URL.Path)
		f.mu.Unlock()
		if f.token != "" && r.Header.Get("Authorization") != "Bearer "+f.token {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"Not Found"}`))
			return
		}
		switch {
		case r.URL.Path == "/repos/o/r":
			_ = json.NewEncoder(w).Encode(map[string]any{"full_name": "o/r", "default_branch": "main"})
		case r.URL.Path == "/repos/o/r/commits/main" || r.URL.Path == "/repos/o/r/commits/v1":
			_ = json.NewEncoder(w).Encode(map[string]any{"sha": "abc123"})
		case r.URL.Path == "/repos/o/r/git/trees/abc123":
			if r.URL.Query().Get("recursive") != "1" {
				t.Errorf("tree must be fetched recursively")
			}
			var entries []map[string]string
			for p := range f.files {
				entries = append(entries, map[string]string{"path": p, "type": "blob", "sha": "blob:" + p})
			}
			entries = append(entries, map[string]string{"path": "nested", "type": "tree", "sha": "t1"})
			_ = json.NewEncoder(w).Encode(map[string]any{"sha": "abc123", "tree": entries, "truncated": f.truncated})
		case strings.HasPrefix(r.URL.Path, "/repos/o/r/git/blobs/"):
			p := strings.TrimPrefix(strings.TrimPrefix(r.URL.Path, "/repos/o/r/git/blobs/"), "blob:")
			content, ok := f.files[p]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			enc := base64.StdEncoding.EncodeToString([]byte(content))
			// GitHub wraps base64 at 60 columns.
			var wrapped strings.Builder
			for i := 0; i < len(enc); i += 60 {
				end := min(i+60, len(enc))
				wrapped.WriteString(enc[i:end] + "\n")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"content": wrapped.String(), "encoding": "base64"})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})
}

func newFake(t *testing.T, f *fakeGitHub) *Client {
	srv := httptest.NewServer(f.handler(t))
	t.Cleanup(srv.Close)
	c := NewClient()
	c.BaseURL = srv.URL
	return c
}

func TestScanRepoFindsActionsAcrossTree(t *testing.T) {
	f := &fakeGitHub{files: map[string]string{
		"action.yml":                       rootAction,
		"nested/action.yaml":               nestedAction,
		"dup/action.yml":                   nestedAction,
		"dup/action.yaml":                  "broken: [",
		"broken/action.yml":                "name: x\nruns: [",
		"node_modules/dep/action.yml":      nestedAction,
		"src/__tests__/fixture/action.yml": nestedAction,
		"README.md":                        "# hi",
		"nested/not-action.yml":            nestedAction,
		".github/actions/setup/action.yml": nestedAction,
	}}
	c := newFake(t, f)

	res, err := c.ScanRepo(context.Background(), "", "o", "r", "")
	if err != nil {
		t.Fatal(err)
	}
	if res.ResolvedRef != "main" || res.SHA != "abc123" {
		t.Fatalf("resolved %q %q", res.ResolvedRef, res.SHA)
	}

	var uses []string
	for _, a := range res.Actions {
		uses = append(uses, a.Uses("o", "r", res.ResolvedRef))
	}
	want := []string{"o/r@main", "o/r/.github/actions/setup@main", "o/r/dup@main", "o/r/nested@main"}
	if strings.Join(uses, ",") != strings.Join(want, ",") {
		t.Fatalf("uses = %v, want %v", uses, want)
	}
	if len(res.Warnings) != 1 || !strings.Contains(res.Warnings[0], "broken/action.yml") {
		t.Fatalf("warnings = %v", res.Warnings)
	}

	root := res.Actions[0].Meta
	if root.Name != "Root action" || root.Icon != "zap" || root.Color != "blue" || root.RunsUsing != "node20" {
		t.Fatalf("root meta = %+v", root)
	}
	if len(root.Inputs) != 3 || root.Inputs[0].Name != "token" || !root.Inputs[0].Required ||
		root.Inputs[1].Default != "info" || root.Inputs[2].DeprecationMessage != "use level" {
		t.Fatalf("inputs = %+v", root.Inputs)
	}
	if len(root.Outputs) != 1 || root.Outputs[0].Name != "result" {
		t.Fatalf("outputs = %+v", root.Outputs)
	}
}

func TestScanRepoUsesGivenRefAndToken(t *testing.T) {
	f := &fakeGitHub{token: "secret", truncated: true, files: map[string]string{"action.yml": nestedAction}}
	c := newFake(t, f)

	if _, err := c.ScanRepo(context.Background(), "", "o", "r", "v1"); !IsNotFound(err) {
		t.Fatalf("without token: err = %v, want not found", err)
	}

	res, err := c.ScanRepo(context.Background(), "secret", "o", "r", "v1")
	if err != nil {
		t.Fatal(err)
	}
	if res.ResolvedRef != "v1" || len(res.Actions) != 1 || res.Actions[0].Uses("o", "r", "v1") != "o/r@v1" {
		t.Fatalf("result = %+v", res)
	}
	if len(res.Warnings) != 1 || !strings.Contains(res.Warnings[0], "too large") {
		t.Fatalf("warnings = %v", res.Warnings)
	}
	for _, p := range f.requests {
		if p == "/repos/o/r" {
			t.Fatalf("default branch lookup should be skipped when a ref is given")
		}
	}
}

func TestParseActionYAMLRequiresRuns(t *testing.T) {
	if _, err := ParseActionYAML([]byte("name: x\n")); err == nil {
		t.Fatal("expected error for action without runs.using")
	}
}
