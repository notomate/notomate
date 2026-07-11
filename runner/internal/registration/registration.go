// Package registration persists the runner's registration (like
// act_runner's .runner file) so restarts reuse the same identity.
package registration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/notomate/notomate-runner/internal/client"
	"github.com/notomate/notomate-runner/internal/config"
)

type State struct {
	RunnerID     string   `json:"runner_id"`
	SessionToken string   `json:"session_token"`
	Name         string   `json:"name"`
	Labels       []string `json:"labels"`
	InstanceAddr string   `json:"instance_addr"`
}

func Load(path string) (State, error) {
	var s State
	data, err := os.ReadFile(path)
	if err != nil {
		return s, err
	}
	if err := json.Unmarshal(data, &s); err != nil {
		return s, fmt.Errorf("parse state file %s: %w", path, err)
	}
	return s, nil
}

func Save(path string, s State) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

// Ensure returns a valid registration, registering with the instance when
// the state file is missing or belongs to a different instance.
func Ensure(ctx context.Context, cfg config.Config, c *client.Client, version string) (State, error) {
	state, err := Load(cfg.StateFile)
	if err == nil && state.SessionToken != "" && state.InstanceAddr == cfg.InstanceAddr {
		return state, nil
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return State{}, err
	}

	if cfg.RegistrationToken == "" {
		return State{}, fmt.Errorf("runner is not registered and NM_RUNNER_REGISTRATION_TOKEN is not set")
	}

	regCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	labels := config.Names(cfg.Labels)
	resp, err := c.Register(regCtx, &client.RegisterRequest{
		RegistrationToken: cfg.RegistrationToken,
		Name:              cfg.Name,
		Version:           version,
		Labels:            labels,
	})
	if err != nil {
		return State{}, fmt.Errorf("register with %s: %w", cfg.InstanceAddr, err)
	}

	state = State{
		RunnerID:     resp.RunnerID,
		SessionToken: resp.SessionToken,
		Name:         cfg.Name,
		Labels:       labels,
		InstanceAddr: cfg.InstanceAddr,
	}
	if err := Save(cfg.StateFile, state); err != nil {
		return State{}, fmt.Errorf("save state file: %w", err)
	}
	return state, nil
}
