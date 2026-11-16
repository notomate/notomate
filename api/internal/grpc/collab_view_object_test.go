package grpcserver

import (
	"context"
	"testing"
	"time"

	"github.com/notomate/notomate/internal/model"
)

// The collab server persists whiteboard view objects (edges, text, notes)
// through these RPCs. They were once dropped from the server while collab
// kept calling them, which silently lost every view object on reload — this
// test guards the full round trip.
func TestCollabViewObjectRPCs(t *testing.T) {
	database, _, conn := setupRunnerTest(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := database.CreateWorkspace(model.Workspace{ID: "ws-1", Name: "ws"}); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	if err := database.CreateView(model.View{ID: "view-1", WorkspaceID: "ws-1", Name: "board", Type: "whiteboard"}); err != nil {
		t.Fatalf("create view: %v", err)
	}

	get := func() []ViewObjectData {
		t.Helper()
		var resp GetViewObjectsResponse
		if err := conn.Invoke(ctx, "/collab.CollabService/GetViewObjects", &GetViewObjectsRequest{ViewID: "view-1"}, &resp); err != nil {
			t.Fatalf("GetViewObjects: %v", err)
		}
		return resp.Objects
	}

	if objs := get(); len(objs) != 0 {
		t.Fatalf("expected no objects, got %d", len(objs))
	}

	edge := ViewObjectData{
		ID:     "1731000000000-abc123xyz",
		ViewID: "view-1",
		Name:   "Edge",
		Type:   "whiteboard_edge",
		Data:   `{"curveType":"elbow"}`,
	}
	if err := conn.Invoke(ctx, "/collab.CollabService/CreateViewObject", &CreateViewObjectRequest{Object: edge}, &CreateViewObjectResponse{}); err != nil {
		t.Fatalf("CreateViewObject: %v", err)
	}
	objs := get()
	if len(objs) != 1 || objs[0].ID != edge.ID || objs[0].Type != "whiteboard_edge" || objs[0].Data != edge.Data {
		t.Fatalf("unexpected objects after create: %+v", objs)
	}

	if err := conn.Invoke(ctx, "/collab.CollabService/UpdateViewObject",
		&UpdateViewObjectRequest{ID: edge.ID, Data: `{"curveType":"straight"}`}, &UpdateViewObjectResponse{}); err != nil {
		t.Fatalf("UpdateViewObject: %v", err)
	}
	if objs := get(); len(objs) != 1 || objs[0].Data != `{"curveType":"straight"}` || objs[0].Type != "whiteboard_edge" {
		t.Fatalf("unexpected objects after update: %+v", objs)
	}

	if err := conn.Invoke(ctx, "/collab.CollabService/DeleteViewObject", &DeleteViewObjectRequest{ID: edge.ID}, &DeleteViewObjectResponse{}); err != nil {
		t.Fatalf("DeleteViewObject: %v", err)
	}
	if objs := get(); len(objs) != 0 {
		t.Fatalf("expected no objects after delete, got %d", len(objs))
	}
}
