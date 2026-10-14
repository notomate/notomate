// Package actionmarket keeps a workspace's action marketplace: the GitHub
// repositories it pulls actions from, the actions found in them, and the
// optional GitHub token used for private repositories.
package actionmarket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/github"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
)

// SyncTimeout bounds one repository scan.
const SyncTimeout = 60 * time.Second

// maxErrorLength keeps last_error readable when many files fail to parse.
const maxErrorLength = 2000

type tokenConfig struct {
	Token string `json:"token"`
}

type Service struct {
	db            db.DB
	client        *github.Client
	encryptionKey func() string
	now           func() time.Time
}

func NewService(d db.DB, client *github.Client, encryptionKey func() string) *Service {
	return &Service{db: d, client: client, encryptionKey: encryptionKey, now: time.Now}
}

// LoadToken returns the workspace's GitHub token, or "" when none is set.
func LoadToken(d db.DB, encryptionKey, workspaceID string) (string, error) {
	i, err := d.FindWorkspaceIntegration(workspaceID, model.WorkspaceIntegrationProviderGitHub)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	plain, err := util.Decrypt(i.ConfigEncrypted, encryptionKey)
	if err != nil {
		return "", fmt.Errorf("decrypt github config: %w", err)
	}
	var cfg tokenConfig
	if err := json.Unmarshal([]byte(plain), &cfg); err != nil {
		return "", err
	}
	return cfg.Token, nil
}

func (s *Service) HasToken(workspaceID string) (bool, error) {
	token, err := LoadToken(s.db, s.encryptionKey(), workspaceID)
	return token != "", err
}

func (s *Service) SaveToken(workspaceID, userID, token string) error {
	plain, err := json.Marshal(tokenConfig{Token: token})
	if err != nil {
		return err
	}
	encrypted, err := util.Encrypt(string(plain), s.encryptionKey())
	if err != nil {
		return err
	}
	now := s.timestamp()
	return s.db.UpsertWorkspaceIntegration(model.WorkspaceIntegration{
		ID:              util.NewId(),
		WorkspaceID:     workspaceID,
		Provider:        model.WorkspaceIntegrationProviderGitHub,
		ConfigEncrypted: encrypted,
		CreatedAt:       now,
		CreatedBy:       userID,
		UpdatedAt:       now,
		UpdatedBy:       userID,
	})
}

func (s *Service) DeleteToken(workspaceID string) error {
	return s.db.DeleteWorkspaceIntegration(workspaceID, model.WorkspaceIntegrationProviderGitHub)
}

// Sync scans the source's repository and replaces its actions. Scan failures
// are recorded on the source (status "error") rather than returned; the
// returned error is only for storage failures.
func (s *Service) Sync(ctx context.Context, src model.ActionSource, userID string) (model.ActionSource, error) {
	token, err := LoadToken(s.db, s.encryptionKey(), src.WorkspaceID)
	if err != nil {
		return src, err
	}

	ctx, cancel := context.WithTimeout(ctx, SyncTimeout)
	defer cancel()
	result, scanErr := s.client.ScanRepo(ctx, token, src.Owner, src.Repo, src.Ref)

	now := s.timestamp()
	src.LastSyncedAt = now
	src.UpdatedAt = now
	src.UpdatedBy = userID

	if scanErr != nil {
		src.Status = model.ActionSourceStatusError
		src.LastError = describeScanError(scanErr, token != "")
		return src, s.db.UpdateActionSourceSync(src)
	}

	actions := make([]model.MarketplaceAction, 0, len(result.Actions))
	for _, a := range result.Actions {
		actions = append(actions, toModel(src, a, result.ResolvedRef, now))
	}
	if err := s.db.ReplaceSourceActions(src.ID, actions); err != nil {
		return src, err
	}

	src.Status = model.ActionSourceStatusOK
	src.ResolvedRef = result.ResolvedRef
	src.ResolvedSHA = result.SHA
	src.LastError = truncate(strings.Join(result.Warnings, "\n"), maxErrorLength)
	if len(actions) == 0 && src.LastError == "" {
		src.LastError = "no action.yml or action.yaml found in this repository"
	}
	return src, s.db.UpdateActionSourceSync(src)
}

func toModel(src model.ActionSource, a github.FoundAction, ref, now string) model.MarketplaceAction {
	inputs := make([]model.ActionInput, 0, len(a.Meta.Inputs))
	for _, in := range a.Meta.Inputs {
		inputs = append(inputs, model.ActionInput{
			Name:               in.Name,
			Description:        in.Description,
			Required:           in.Required,
			Default:            in.Default,
			DeprecationMessage: in.DeprecationMessage,
		})
	}
	outputs := make([]model.ActionOutput, 0, len(a.Meta.Outputs))
	for _, out := range a.Meta.Outputs {
		outputs = append(outputs, model.ActionOutput{Name: out.Name, Description: out.Description})
	}
	return model.MarketplaceAction{
		ID:          util.NewId(),
		SourceID:    src.ID,
		WorkspaceID: src.WorkspaceID,
		Path:        a.Dir,
		Uses:        a.Uses(src.Owner, src.Repo, ref),
		Name:        a.Meta.Name,
		Description: a.Meta.Description,
		Author:      a.Meta.Author,
		Icon:        a.Meta.Icon,
		Color:       a.Meta.Color,
		RunsUsing:   a.Meta.RunsUsing,
		Inputs:      inputs,
		Outputs:     outputs,
		CreatedAt:   now,
	}
}

func describeScanError(err error, hasToken bool) string {
	if github.IsNotFound(err) {
		if hasToken {
			return "repository or ref not found, or the GitHub token cannot access it"
		}
		return "repository or ref not found; private repositories need a GitHub token"
	}
	var apiErr *github.APIError
	if errors.As(err, &apiErr) && (apiErr.StatusCode == 401 || apiErr.StatusCode == 403) {
		return fmt.Sprintf("GitHub rejected the request (%s); check the token or rate limit", apiErr.Error())
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timed out reading the repository from GitHub"
	}
	return truncate(err.Error(), maxErrorLength)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func (s *Service) timestamp() string {
	return s.now().UTC().Format(time.RFC3339)
}
