package db

import (
	"errors"
	"testing"
)

func TestIsRetryable(t *testing.T) {
	for msg, want := range map[string]bool{
		"Error 1213 (40001): Deadlock found when trying to get lock; try restarting transaction": true,
		"ERROR: deadlock detected (SQLSTATE 40P01)":                                              true,
		"ERROR: could not serialize access (SQLSTATE 40001)":                                     true,
		"database is locked":                  true,
		"Error 1062 (23000): Duplicate entry": false,
	} {
		if got := isRetryable(errors.New(msg)); got != want {
			t.Errorf("isRetryable(%q) = %v, want %v", msg, got, want)
		}
	}
	if isRetryable(nil) {
		t.Error("nil is not retryable")
	}
}
