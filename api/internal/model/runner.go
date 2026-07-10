package model

type RunnerFilter struct {
	ID string
}

type Runner struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Labels       string `json:"labels"` // JSON array of labels
	TokenHash    string `json:"-"`      // Never expose hash in JSON
	Version      string `json:"version"`
	Status       string `json:"status"`
	LastOnlineAt string `json:"last_online_at"`
	CreatedAt    string `json:"created_at"`
}

const (
	RunnerStatusOnline  = "online"
	RunnerStatusOffline = "offline"
)

const SettingKeyRunnerRegistrationToken = "runner_registration_token"

type Setting struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	UpdatedAt string `json:"updated_at"`
}
