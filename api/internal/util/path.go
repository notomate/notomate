package util

import (
	"errors"
	"path"
	"strings"
)

const (
	MaxRelativePathLength   = 255
	MaxRelativePathSegments = 20
)

// SanitizeRelativePath validates and normalizes a user-supplied relative file
// path (e.g. for workflow codebase files) so it can never escape the
// directory it is eventually written under. It rejects absolute paths,
// Windows drive-letter prefixes, NUL bytes, and any "..", "." or empty path
// segment. Callers must still treat the returned path as untrusted when
// joining it onto a filesystem root (re-check the joined result stays under
// that root) - this only guarantees the path itself is a well-formed,
// traversal-free relative path.
func SanitizeRelativePath(p string) (string, error) {
	if p == "" {
		return "", errors.New("path is required")
	}
	if len(p) > MaxRelativePathLength {
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
	if len(segments) > MaxRelativePathSegments {
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
