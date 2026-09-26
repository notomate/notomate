package run

import (
	"context"
	"io"

	"github.com/nektos/act/pkg/common"
	"github.com/nektos/act/pkg/runner"
)

// retryingActionCache retries resolving a `uses:` ref when the forge is
// transiently unreachable.
//
// It wraps GoGitActionCacheOfflineMode rather than sitting inside it on
// purpose: the offline cache already answers from the sha on disk when a
// fetch fails, and returns no error when it can. So a retry only ever happens
// for an action that is genuinely not cached yet -- an action already in the
// cache proceeds after the first failed attempt instead of waiting out the
// full backoff.
type retryingActionCache struct {
	inner runner.ActionCache
}

func (c retryingActionCache) Fetch(ctx context.Context, cacheDir, url, ref, token string) (string, error) {
	var sha string
	err := common.RetryTransientNetwork(ctx, "fetch "+url+"@"+ref, func() error {
		var err error
		sha, err = c.inner.Fetch(ctx, cacheDir, url, ref, token)
		return err
	})
	return sha, err
}

func (c retryingActionCache) GetTarArchive(ctx context.Context, cacheDir, sha, includePrefix string) (io.ReadCloser, error) {
	// Reads from the local bare repo; nothing to retry.
	return c.inner.GetTarArchive(ctx, cacheDir, sha, includePrefix)
}
