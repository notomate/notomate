package common

import (
	"context"
	"errors"
	"io"
	"net"
	"time"
)

// Retry policy for network operations against a git remote. github.com
// occasionally leaves a TCP handshake unanswered, which surfaces 30s later
// (net/http's default dial timeout) as "dial tcp <ip>:443: i/o timeout".
// Without retrying, one dropped SYN fails a whole job even though the remote
// is reachable a second later.
const (
	networkRetryAttempts     = 3
	networkRetryInitialDelay = 2 * time.Second
)

// RetryTransientNetwork runs fn, retrying with exponential backoff while it
// keeps failing with a transient network error. Non-network errors (auth
// failures, missing refs) are returned on the first attempt, as is the error
// from the final attempt.
func RetryTransientNetwork(ctx context.Context, desc string, fn func() error) error {
	logger := Logger(ctx)
	delay := networkRetryInitialDelay

	var err error
	for attempt := 1; ; attempt++ {
		if err = fn(); err == nil || !IsTransientNetworkError(err) || attempt >= networkRetryAttempts {
			return err
		}

		logger.Warnf("%s failed (attempt %d/%d): %v; retrying in %s", desc, attempt, networkRetryAttempts, err, delay)
		select {
		case <-ctx.Done():
			return errors.Join(err, ctx.Err())
		case <-time.After(delay):
		}
		delay *= 2
	}
}

// IsTransientNetworkError reports whether err is worth retrying: a timeout,
// refused/reset connection, DNS failure, or a truncated response. A cancelled
// context is never transient -- the caller asked us to stop.
func IsTransientNetworkError(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	return errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF)
}
