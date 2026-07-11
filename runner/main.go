// notomate-runner is the Notomate workflow runner: it registers with a
// Notomate instance, long-polls for queued workflow jobs and executes them
// in Docker containers via the embedded act library, in the style of Gitea's
// act_runner.
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/notomate/notomate-runner/internal/client"
	"github.com/notomate/notomate-runner/internal/config"
	"github.com/notomate/notomate-runner/internal/registration"
	"github.com/notomate/notomate-runner/internal/run"
)

// Version is set at build time via ldflags.
var Version = "dev"

const (
	backoffInitial = time.Second
	backoffMax     = 30 * time.Second
)

func main() {
	log.Printf("Starting Notomate runner version: %s", Version)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	c, err := client.New(cfg.InstanceAddr)
	if err != nil {
		log.Fatalf("Failed to create client for %s: %v", cfg.InstanceAddr, err)
	}
	defer c.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	state, err := ensureRegistration(ctx, cfg, c)
	if err != nil {
		log.Fatalf("Failed to register: %v", err)
	}
	c.SetSessionToken(state.SessionToken)
	log.Printf("Runner %q (%s) polling %s with labels %v", state.Name, state.RunnerID, cfg.InstanceAddr, state.Labels)

	runner := run.New(cfg, c)
	backoff := backoffInitial

	for {
		if ctx.Err() != nil {
			log.Println("Shutting down")
			return
		}

		// The server long-polls up to 30s; allow a little slack.
		pollCtx, cancel := context.WithTimeout(ctx, 40*time.Second)
		resp, err := c.FetchTask(pollCtx)
		cancel()

		if err != nil {
			if ctx.Err() != nil {
				continue
			}
			log.Printf("Fetch task: %v (retrying in %s)", err, backoff)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
			}
			backoff = min(backoff*2, backoffMax)
			continue
		}
		backoff = backoffInitial

		if !resp.Found || resp.Job == nil {
			continue
		}

		// A SIGTERM during the job stops polling afterwards; the job itself
		// runs to completion unless the server cancels it.
		if err := runner.Run(context.WithoutCancel(ctx), resp.Job); err != nil {
			log.Printf("Job %s: %v", resp.Job.JobID, err)
		}
	}
}

// ensureRegistration retries registration until it succeeds or the runner is
// stopped, so the runner container can start before the API is reachable.
func ensureRegistration(ctx context.Context, cfg config.Config, c *client.Client) (registration.State, error) {
	backoff := backoffInitial
	for {
		state, err := registration.Ensure(ctx, cfg, c, Version)
		if err == nil {
			return state, nil
		}
		if ctx.Err() != nil {
			return registration.State{}, err
		}
		log.Printf("Registration: %v (retrying in %s)", err, backoff)
		select {
		case <-time.After(backoff):
		case <-ctx.Done():
			return registration.State{}, ctx.Err()
		}
		backoff = min(backoff*2, backoffMax)
	}
}
