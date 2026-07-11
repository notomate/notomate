package workflow

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
)

// EnsureRegistrationToken resolves the runner registration token: the
// RUNNER_REGISTRATION_TOKEN env wins; otherwise a token is generated once and
// persisted in the settings table.
func EnsureRegistrationToken(database db.DB) (string, error) {
	if t := config.C.GetString(config.RUNNER_REGISTRATION_TOKEN); t != "" {
		return t, nil
	}

	setting, err := database.FindSetting(model.SettingKeyRunnerRegistrationToken)
	if err == nil {
		return setting.Value, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}

	raw := make([]byte, 20)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := hex.EncodeToString(raw)
	if err := database.UpsertSetting(model.Setting{
		Key:       model.SettingKeyRunnerRegistrationToken,
		Value:     token,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		return "", err
	}
	return token, nil
}
