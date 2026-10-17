package sqlitedb

import (
	"testing"

	"github.com/notomate/notomate/internal/model"
)

func TestFindFilesMissingDimensions(t *testing.T) {
	db := newTestDB(t)
	if err := db.CreateWorkspace(model.Workspace{ID: "ws", Name: "ws"}); err != nil {
		t.Fatal(err)
	}
	ten := 10
	for _, f := range []model.File{
		{ID: "1", Name: "a.JPG", Ext: ".JPG"},
		{ID: "2", Name: "b.txt", Ext: ".txt"},
		{ID: "3", Name: "c.png", Ext: ".png", Width: &ten, Height: &ten},
		{ID: "4", Name: "d.webp", Ext: ".webp"},
	} {
		f.WorkspaceID = "ws"
		if err := db.CreateFile(f); err != nil {
			t.Fatal(err)
		}
	}
	exts := []string{".jpg", ".png", ".webp"}

	files, err := db.FindFilesMissingDimensions("", exts, 1)
	if err != nil || len(files) != 1 || files[0].ID != "1" {
		t.Fatalf("first page: %+v err %v", files, err)
	}
	if err := db.UpdateFileDimensions("1", 0, 0); err != nil {
		t.Fatal(err)
	}
	files, err = db.FindFilesMissingDimensions("", exts, 10)
	if err != nil || len(files) != 1 || files[0].ID != "4" {
		t.Fatalf("after update: %+v err %v", files, err)
	}
	got, err := db.FindFileByID("1")
	if err != nil || got.Width == nil || *got.Width != 0 {
		t.Fatalf("expected 0 width recorded, got %+v err %v", got, err)
	}
}
