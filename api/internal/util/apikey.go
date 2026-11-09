package util

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	APIKeyPrefix = "ntp_"
	APIKeyLength = 32 // characters after prefix
)

// GenerateAPIKey generates a new API key with format: ntp_<32-random-chars>
// Returns: fullKey, prefix (first 12 chars), error
func GenerateAPIKey() (string, string, error) {
	// Generate 16 random bytes = 32 hex characters
	randomBytes := make([]byte, 16)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	randomString := hex.EncodeToString(randomBytes)
	fullKey := APIKeyPrefix + randomString

	// Prefix is first 12 characters (ntp_ + first 8 chars of random)
	prefix := fullKey[:12]

	return fullKey, prefix, nil
}

// ExtractPrefix extracts the prefix from a full API key
func ExtractPrefix(apiKey string) string {
	if len(apiKey) < 12 {
		return ""
	}
	return apiKey[:12]
}

// ValidateAPIKeyFormat checks if the API key has valid format
func ValidateAPIKeyFormat(apiKey string) bool {
	expectedLength := len(APIKeyPrefix) + APIKeyLength
	if len(apiKey) != expectedLength {
		return false
	}
	if apiKey[:len(APIKeyPrefix)] != APIKeyPrefix {
		return false
	}
	return true
}

const (
	verifiedKeyTTL = 5 * time.Minute
	verifiedKeyMax = 10000
)

type verifiedKey struct {
	keyHash string
	until   time.Time
}

var (
	verifiedKeysMu sync.RWMutex
	verifiedKeys   = map[[32]byte]verifiedKey{}
)

// VerifyAPIKey checks a key against its stored bcrypt hash. Successes are
// remembered briefly because an MCP client makes many requests in a row and
// bcrypt at cost 12 is far too slow to repeat for each. The caller still loads
// the key's row on every request, so deleting a key takes effect immediately.
func VerifyAPIKey(keyHash, apiKey string) error {
	id := sha256.Sum256([]byte(apiKey))
	now := time.Now()

	verifiedKeysMu.RLock()
	cached, ok := verifiedKeys[id]
	verifiedKeysMu.RUnlock()
	if ok && cached.keyHash == keyHash && now.Before(cached.until) {
		return nil
	}

	if err := bcrypt.CompareHashAndPassword([]byte(keyHash), []byte(apiKey)); err != nil {
		return err
	}

	verifiedKeysMu.Lock()
	defer verifiedKeysMu.Unlock()
	if len(verifiedKeys) >= verifiedKeyMax {
		verifiedKeys = map[[32]byte]verifiedKey{}
	}
	verifiedKeys[id] = verifiedKey{keyHash: keyHash, until: now.Add(verifiedKeyTTL)}
	return nil
}
