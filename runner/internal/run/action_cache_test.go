package run

import (
	"context"
	"errors"
	"io"
	"net"
	"testing"

	"github.com/nektos/act/pkg/runner"
)

type stubActionCache struct {
	attempts int
	failures int
	err      error
}

func (s *stubActionCache) Fetch(_ context.Context, _, _, _, _ string) (string, error) {
	s.attempts++
	if s.attempts <= s.failures {
		return "", s.err
	}
	return "deadbeef", nil
}

func (s *stubActionCache) GetTarArchive(_ context.Context, _, _, _ string) (io.ReadCloser, error) {
	return nil, nil
}

func timeoutErr() error {
	return &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("i/o timeout")}
}

func TestRetryingActionCacheRetriesTransientFailures(t *testing.T) {
	stub := &stubActionCache{failures: 1, err: timeoutErr()}
	sha, err := retryingActionCache{inner: stub}.Fetch(context.Background(), "a/b", "https://example.test/a/b", "v1", "")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if sha != "deadbeef" {
		t.Errorf("sha = %q, want deadbeef", sha)
	}
	if stub.attempts != 2 {
		t.Errorf("attempts = %d, want 2", stub.attempts)
	}
}

// The offline cache answers from disk rather than erroring when it has the
// action, so a cache hit must not spend the retry budget.
func TestRetryingActionCacheDoesNotRetryOnSuccess(t *testing.T) {
	stub := &stubActionCache{}
	if _, err := (retryingActionCache{inner: stub}).Fetch(context.Background(), "a/b", "https://example.test/a/b", "v1", ""); err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if stub.attempts != 1 {
		t.Errorf("attempts = %d, want 1", stub.attempts)
	}
}

func TestRetryingActionCacheGivesUpOnNonTransientFailures(t *testing.T) {
	stub := &stubActionCache{failures: 99, err: errors.New("authentication required")}
	if _, err := (retryingActionCache{inner: stub}).Fetch(context.Background(), "a/b", "https://example.test/a/b", "v1", ""); err == nil {
		t.Fatal("expected an error")
	}
	if stub.attempts != 1 {
		t.Errorf("attempts = %d, want 1", stub.attempts)
	}
}

func TestRetryingActionCacheStopsOnCancelledContext(t *testing.T) {
	stub := &stubActionCache{failures: 99, err: timeoutErr()}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := (retryingActionCache{inner: stub}).Fetch(ctx, "a/b", "https://example.test/a/b", "v1", ""); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if stub.attempts != 1 {
		t.Errorf("attempts = %d, want 1", stub.attempts)
	}
}

var _ runner.ActionCache = retryingActionCache{}
