package github

import (
	"context"
	"fmt"
	"path"
	"sort"
	"strings"
	"sync"
)

const (
	// MaxActionsPerRepo caps how many action.yml files one sync reads.
	MaxActionsPerRepo = 200

	fetchConcurrency = 4
)

// Directories that hold dependencies or test fixtures rather than actions
// anyone would want to pick.
var skippedDirs = map[string]bool{
	"node_modules": true,
	".git":         true,
	"__tests__":    true,
	"__fixtures__": true,
	"fixtures":     true,
	"testdata":     true,
	"vendor":       true,
	"third_party":  true,
}

// FoundAction is one action discovered in a repository. Dir is the
// directory holding action.yml, "" for the repository root.
type FoundAction struct {
	Dir  string
	Meta ActionMetadata
}

// Uses returns the `uses:` value for the action at ref.
func (a FoundAction) Uses(owner, repo, ref string) string {
	if a.Dir == "" {
		return fmt.Sprintf("%s/%s@%s", owner, repo, ref)
	}
	return fmt.Sprintf("%s/%s/%s@%s", owner, repo, a.Dir, ref)
}

type ScanResult struct {
	// ResolvedRef is the requested ref, or the default branch when none was
	// given.
	ResolvedRef string
	SHA         string
	Actions     []FoundAction
	// Warnings lists files that could not be read or parsed and limits that
	// were hit; they don't fail the scan.
	Warnings []string
}

// ScanRepo lists every action.yml / action.yaml in the repository tree at ref
// (the default branch when ref is empty) and parses their metadata.
func (c *Client) ScanRepo(ctx context.Context, token, owner, repo, ref string) (ScanResult, error) {
	var result ScanResult

	if ref == "" {
		info, err := c.GetRepo(ctx, token, owner, repo)
		if err != nil {
			return result, err
		}
		ref = info.DefaultBranch
	}
	result.ResolvedRef = ref

	sha, err := c.ResolveRef(ctx, token, owner, repo, ref)
	if err != nil {
		return result, err
	}
	result.SHA = sha

	tree, err := c.GetTree(ctx, token, owner, repo, sha)
	if err != nil {
		return result, err
	}
	if tree.Truncated {
		result.Warnings = append(result.Warnings, "repository tree is too large; some actions may be missing")
	}

	blobs := actionBlobs(tree.Entries)
	if len(blobs) > MaxActionsPerRepo {
		result.Warnings = append(result.Warnings, fmt.Sprintf("found %d actions; only the first %d were imported", len(blobs), MaxActionsPerRepo))
		blobs = blobs[:MaxActionsPerRepo]
	}

	found := make([]*FoundAction, len(blobs))
	warnings := make([]string, len(blobs))
	sem := make(chan struct{}, fetchConcurrency)
	var wg sync.WaitGroup
	for i, entry := range blobs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			data, err := c.GetBlob(ctx, token, owner, repo, entry.SHA)
			if err != nil {
				warnings[i] = fmt.Sprintf("%s: %v", entry.Path, err)
				return
			}
			meta, err := ParseActionYAML(data)
			if err != nil {
				warnings[i] = fmt.Sprintf("%s: %v", entry.Path, err)
				return
			}
			dir := path.Dir(entry.Path)
			if dir == "." {
				dir = ""
			}
			if meta.Name == "" {
				meta.Name = path.Base(path.Join(repo, dir))
			}
			found[i] = &FoundAction{Dir: dir, Meta: meta}
		}()
	}
	wg.Wait()

	if err := ctx.Err(); err != nil {
		return result, err
	}
	for i := range blobs {
		if found[i] != nil {
			result.Actions = append(result.Actions, *found[i])
		}
		if warnings[i] != "" {
			result.Warnings = append(result.Warnings, warnings[i])
		}
	}
	return result, nil
}

// actionBlobs picks the action metadata files out of a tree, one per
// directory (action.yml wins over action.yaml, as on GitHub), sorted by path
// with the repository root first.
func actionBlobs(entries []TreeEntry) []TreeEntry {
	byDir := map[string]TreeEntry{}
	for _, e := range entries {
		if e.Type != "blob" {
			continue
		}
		base := path.Base(e.Path)
		if base != "action.yml" && base != "action.yaml" {
			continue
		}
		dir := path.Dir(e.Path)
		if inSkippedDir(dir) {
			continue
		}
		if existing, ok := byDir[dir]; ok && path.Base(existing.Path) == "action.yml" {
			continue
		}
		byDir[dir] = e
	}

	out := make([]TreeEntry, 0, len(byDir))
	for _, e := range byDir {
		out = append(out, e)
	}
	sort.Slice(out, func(i, j int) bool {
		di, dj := path.Dir(out[i].Path), path.Dir(out[j].Path)
		if (di == ".") != (dj == ".") {
			return di == "."
		}
		return di < dj
	})
	return out
}

func inSkippedDir(dir string) bool {
	if dir == "." {
		return false
	}
	for _, seg := range strings.Split(dir, "/") {
		if skippedDirs[seg] {
			return true
		}
	}
	return false
}
