// Package github reads GitHub repositories over the REST API to discover the
// actions (action.yml / action.yaml) they contain.
package github

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	DefaultBaseURL = "https://api.github.com"

	maxResponseBytes = 32 << 20
)

// APIError is a non-2xx response from GitHub.
type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	if e.Message == "" {
		return fmt.Sprintf("github api: http %d", e.StatusCode)
	}
	return fmt.Sprintf("github api: http %d: %s", e.StatusCode, e.Message)
}

// IsNotFound reports whether err is a 404 from GitHub. GitHub also answers
// 404 for private repositories the token cannot see.
func IsNotFound(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusNotFound
}

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func NewClient() *Client {
	return &Client{
		BaseURL: DefaultBaseURL,
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

type Repo struct {
	FullName      string `json:"full_name"`
	DefaultBranch string `json:"default_branch"`
	Private       bool   `json:"private"`
}

type TreeEntry struct {
	Path string `json:"path"`
	Type string `json:"type"`
	SHA  string `json:"sha"`
}

type Tree struct {
	SHA       string      `json:"sha"`
	Entries   []TreeEntry `json:"tree"`
	Truncated bool        `json:"truncated"`
}

func (c *Client) GetRepo(ctx context.Context, token, owner, repo string) (Repo, error) {
	var out Repo
	err := c.getJSON(ctx, token, fmt.Sprintf("/repos/%s/%s", url.PathEscape(owner), url.PathEscape(repo)), &out)
	return out, err
}

// ResolveRef returns the commit SHA a branch, tag or SHA points at.
func (c *Client) ResolveRef(ctx context.Context, token, owner, repo, ref string) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	err := c.getJSON(ctx, token, fmt.Sprintf("/repos/%s/%s/commits/%s", url.PathEscape(owner), url.PathEscape(repo), url.PathEscape(ref)), &out)
	if err == nil && out.SHA == "" {
		err = fmt.Errorf("github api: ref %q did not resolve to a commit", ref)
	}
	return out.SHA, err
}

func (c *Client) GetTree(ctx context.Context, token, owner, repo, sha string) (Tree, error) {
	var out Tree
	err := c.getJSON(ctx, token, fmt.Sprintf("/repos/%s/%s/git/trees/%s?recursive=1", url.PathEscape(owner), url.PathEscape(repo), url.PathEscape(sha)), &out)
	return out, err
}

// GetBlob returns the raw content of a blob by its SHA.
func (c *Client) GetBlob(ctx context.Context, token, owner, repo, sha string) ([]byte, error) {
	var out struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	if err := c.getJSON(ctx, token, fmt.Sprintf("/repos/%s/%s/git/blobs/%s", url.PathEscape(owner), url.PathEscape(repo), url.PathEscape(sha)), &out); err != nil {
		return nil, err
	}
	if out.Encoding != "base64" {
		return []byte(out.Content), nil
	}
	// GitHub wraps base64 content at 60 columns.
	return base64.StdEncoding.DecodeString(strings.ReplaceAll(out.Content, "\n", ""))
}

func (c *Client) getJSON(ctx context.Context, token, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(c.BaseURL, "/")+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, maxResponseBytes))
	if err != nil {
		return err
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		var apiErr struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(body, &apiErr)
		return &APIError{StatusCode: res.StatusCode, Message: apiErr.Message}
	}
	return json.Unmarshal(body, out)
}
