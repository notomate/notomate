package run

import (
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/notomate/notomate-runner/internal/client"
)

const (
	maxWorkflowFilePathLength   = 255
	maxWorkflowFilePathSegments = 20
)

// writeWorkflowFiles materializes a workflow's codebase files into workdir,
// preserving their relative paths, so job steps see a directory layout
// equivalent to a git checkout. Every path is independently re-validated
// here even though the API already validates on upload - this is the last
// line of defense before anything touches the local filesystem, and the
// runner must not trust the wire payload just because it came from "our
// own" API.
func writeWorkflowFiles(workdir string, files []client.WorkflowFileData) error {
	workdirClean := filepath.Clean(workdir)

	for _, f := range files {
		cleanPath, err := sanitizeRelativePath(f.Path)
		if err != nil {
			return fmt.Errorf("workflow file %q: %w", f.Path, err)
		}

		dest := filepath.Clean(filepath.Join(workdirClean, filepath.FromSlash(cleanPath)))
		if dest != workdirClean && !strings.HasPrefix(dest, workdirClean+string(filepath.Separator)) {
			return fmt.Errorf("workflow file %q escapes the job workdir", f.Path)
		}

		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return fmt.Errorf("create directory for %q: %w", f.Path, err)
		}
		// Fixed permissions regardless of any caller-supplied mode - never
		// trust a mode bit coming off the wire.
		if err := os.WriteFile(dest, f.Content, 0o644); err != nil {
			return fmt.Errorf("write %q: %w", f.Path, err)
		}
	}
	return nil
}

// sanitizeRelativePath mirrors api/internal/util.SanitizeRelativePath. It is
// duplicated rather than imported because the runner is a separate Go
// module from the API - this is the runner's own independent check, not a
// shared dependency, which is the point: a bug in one validator shouldn't
// automatically be a bug in both.
func sanitizeRelativePath(p string) (string, error) {
	if p == "" {
		return "", errors.New("path is required")
	}
	if len(p) > maxWorkflowFilePathLength {
		return "", errors.New("path is too long")
	}
	if strings.ContainsRune(p, 0) {
		return "", errors.New("path contains invalid characters")
	}

	normalized := strings.ReplaceAll(p, "\\", "/")

	if strings.HasPrefix(normalized, "/") {
		return "", errors.New("path must be relative")
	}
	if len(normalized) >= 2 && normalized[1] == ':' {
		return "", errors.New("path must be relative")
	}

	segments := strings.Split(normalized, "/")
	if len(segments) > maxWorkflowFilePathSegments {
		return "", errors.New("path has too many segments")
	}
	for _, seg := range segments {
		if seg == "" || seg == "." || seg == ".." {
			return "", errors.New("path contains an invalid segment")
		}
	}

	cleaned := path.Clean(normalized)
	if cleaned != normalized || strings.HasPrefix(cleaned, "../") || cleaned == ".." {
		return "", errors.New("path escapes the allowed directory")
	}

	return cleaned, nil
}
