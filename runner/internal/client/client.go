// Package client implements the Notomate runner protocol
// (api/proto/runner.proto): JSON-over-gRPC with a session token in the
// authorization metadata.
package client

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

// Message types mirror the JSON structs in api/internal/grpc/runner_service.go.

type RegisterRequest struct {
	RegistrationToken string   `json:"registration_token"`
	Name              string   `json:"name"`
	Version           string   `json:"version"`
	Labels            []string `json:"labels"`
}
type RegisterResponse struct {
	RunnerID     string `json:"runner_id"`
	SessionToken string `json:"session_token"`
}

type FetchTaskRequest struct{}
type FetchTaskResponse struct {
	Found bool         `json:"found"`
	Job   *TaskPayload `json:"job,omitempty"`
}
type TaskPayload struct {
	JobID            string             `json:"job_id"`
	RunID            string             `json:"run_id"`
	RunNumber        int                `json:"run_number"`
	WorkspaceID      string             `json:"workspace_id"`
	WorkflowName     string             `json:"workflow_name"`
	JobName          string             `json:"job_name"`
	WorkflowYAML     string             `json:"workflow_yaml"`
	EventName        string             `json:"event_name"`
	EventPayloadJSON string             `json:"event_payload_json"`
	Vars             map[string]string  `json:"vars,omitempty"`
	Secrets          map[string]string  `json:"secrets,omitempty"`
	Files            []WorkflowFileData `json:"files,omitempty"`
}

// WorkflowFileData is one codebase file attached to a workflow, delivered
// inline so the runner can materialize it into the job's scratch workdir.
// Path is expected to already be a validated relative path, but the runner
// must not trust that and re-validates before touching the filesystem (see
// writeWorkflowFiles in internal/run).
type WorkflowFileData struct {
	Path    string `json:"path"`
	Content []byte `json:"content"`
}

type UpdateTaskRequest struct {
	JobID   string `json:"job_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}
type UpdateTaskResponse struct {
	Cancelled bool `json:"cancelled"`
}

type UpdateLogRequest struct {
	JobID     string   `json:"job_id"`
	StartLine int      `json:"start_line"`
	Lines     []string `json:"lines"`
}
type UpdateLogResponse struct {
	AckLine   int  `json:"ack_line"`
	Cancelled bool `json:"cancelled"`
}

type Client struct {
	conn         *grpc.ClientConn
	sessionToken string
}

func New(addr string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &Client{conn: conn}, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

func (c *Client) SetSessionToken(token string) {
	c.sessionToken = token
}

func (c *Client) authCtx(ctx context.Context) context.Context {
	if c.sessionToken == "" {
		return ctx
	}
	return metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+c.sessionToken)
}

func (c *Client) Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	resp := &RegisterResponse{}
	if err := c.conn.Invoke(ctx, "/runner.RunnerService/Register", req, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *Client) FetchTask(ctx context.Context) (*FetchTaskResponse, error) {
	resp := &FetchTaskResponse{}
	if err := c.conn.Invoke(c.authCtx(ctx), "/runner.RunnerService/FetchTask", &FetchTaskRequest{}, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *Client) UpdateTask(ctx context.Context, req *UpdateTaskRequest) (*UpdateTaskResponse, error) {
	resp := &UpdateTaskResponse{}
	if err := c.conn.Invoke(c.authCtx(ctx), "/runner.RunnerService/UpdateTask", req, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

func (c *Client) UpdateLog(ctx context.Context, req *UpdateLogRequest) (*UpdateLogResponse, error) {
	resp := &UpdateLogResponse{}
	if err := c.conn.Invoke(c.authCtx(ctx), "/runner.RunnerService/UpdateLog", req, resp); err != nil {
		return nil, err
	}
	return resp, nil
}
