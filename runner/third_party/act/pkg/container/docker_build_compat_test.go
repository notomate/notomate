//go:build !(WITHOUT_DOCKER || !(linux || darwin || windows || netbsd))

package container

import (
	"archive/tar"
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"
)

// Verify the patched archive API still produces an uncompressed Docker build
// context, honors .dockerignore, and preserves the Dockerfile even if excluded.
func TestBuildContextArchiveCompatibility(t *testing.T) {
	dir := t.TempDir()
	for name, content := range map[string]string{
		"Dockerfile":    "FROM scratch\n",
		".dockerignore": "Dockerfile\nsecret.txt\n",
		"app.txt":       "application",
		"secret.txt":    "must not be sent to Docker",
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	stream, err := createBuildContext(context.Background(), dir, "Dockerfile")
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	files := map[string]string{}
	reader := tar.NewReader(stream)
	for {
		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		content, err := io.ReadAll(reader)
		if err != nil {
			t.Fatal(err)
		}
		files[header.Name] = string(content)
	}
	if files["Dockerfile"] != "FROM scratch\n" || files["app.txt"] != "application" {
		t.Fatalf("build context missing expected files: %v", files)
	}
	if _, exists := files["secret.txt"]; exists {
		t.Fatal("build context includes an ignored file")
	}
}
