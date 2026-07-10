package config

import (
	"fmt"
	"os"
	"strings"
)

// Label is a runner label: the name is matched against a job's runs-on and
// the image is the Docker image act uses for that platform.
type Label struct {
	Name  string
	Image string
}

type Config struct {
	// InstanceAddr is the CollabReef API gRPC address (host:port).
	InstanceAddr string
	// RegistrationToken must match the instance's runner registration token.
	RegistrationToken string
	Name              string
	Labels            []Label
	// StateFile persists the registration (runner id + session token).
	StateFile string
	// DaemonSocket is passed to act as the Docker daemon socket for job
	// containers. Empty lets act use its default (/var/run/docker.sock).
	DaemonSocket string
}

const defaultLabels = "ubuntu-latest:docker://node:20-bullseye"

func Load() (Config, error) {
	cfg := Config{
		InstanceAddr:      envOr("CB_INSTANCE_ADDR", "localhost:50051"),
		RegistrationToken: os.Getenv("CB_RUNNER_REGISTRATION_TOKEN"),
		Name:              os.Getenv("CB_RUNNER_NAME"),
		StateFile:         envOr("CB_RUNNER_STATE_FILE", ".runner"),
		DaemonSocket:      os.Getenv("CB_RUNNER_DAEMON_SOCKET"),
	}

	if cfg.Name == "" {
		if host, err := os.Hostname(); err == nil {
			cfg.Name = host
		} else {
			cfg.Name = "runner"
		}
	}

	labels, err := ParseLabels(envOr("CB_RUNNER_LABELS", defaultLabels))
	if err != nil {
		return cfg, err
	}
	cfg.Labels = labels

	return cfg, nil
}

// ParseLabels parses a comma-separated list of labels in act_runner style:
// "name[:docker://image]". A bare name defaults to node:20-bullseye.
func ParseLabels(raw string) ([]Label, error) {
	var labels []Label
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		name, scheme, found := strings.Cut(part, ":")
		if name == "" {
			return nil, fmt.Errorf("invalid label %q", part)
		}
		image := "node:20-bullseye"
		if found {
			img, ok := strings.CutPrefix(scheme, "docker://")
			if !ok || img == "" {
				return nil, fmt.Errorf("invalid label %q: only docker:// schemes are supported", part)
			}
			image = img
		}
		labels = append(labels, Label{Name: name, Image: image})
	}
	if len(labels) == 0 {
		return nil, fmt.Errorf("no labels configured")
	}
	return labels, nil
}

// Names returns just the label names, as sent to the server.
func Names(labels []Label) []string {
	names := make([]string, 0, len(labels))
	for _, l := range labels {
		names = append(names, l.Name)
	}
	return names
}

// Platforms returns the act platform map (label name -> image).
func Platforms(labels []Label) map[string]string {
	platforms := make(map[string]string, len(labels))
	for _, l := range labels {
		platforms[l.Name] = l.Image
	}
	return platforms
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
