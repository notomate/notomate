package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
	"golang.org/x/crypto/bcrypt"
)

// OAuth 2.1 authorization server for the MCP endpoint: public clients only,
// PKCE S256 required, refresh tokens rotated. Access tokens are API keys scoped
// to the MCP routes, so nothing downstream needs to know about OAuth.

const (
	oauthCodeTTL         = 5 * time.Minute
	oauthAccessTokenTTL  = time.Hour
	oauthRefreshTokenTTL = 90 * 24 * time.Hour
	oauthUnusedClientTTL = 30 * 24 * time.Hour

	oauthMaxRedirectURIs   = 5
	oauthMaxRedirectLength = 2048
	oauthMaxClientName     = 100
	oauthMaxBodyBytes      = 64 * 1024
)

func oauthPublicBaseURL(c echo.Context) string {
	if base := config.C.GetString(config.APP_PUBLIC_URL); base != "" {
		return strings.TrimRight(base, "/")
	}
	return c.Scheme() + "://" + c.Request().Host
}

func oauthNow() string { return time.Now().UTC().Format(time.RFC3339) }

func oauthHash(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func oauthRandomToken(prefix string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(b), nil
}

func isLoopbackHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// validRedirectURI accepts https callbacks and http callbacks on loopback (native clients).
func validRedirectURI(raw string) bool {
	if raw == "" || len(raw) > oauthMaxRedirectLength {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.Fragment != "" || u.User != nil {
		return false
	}
	return u.Scheme == "https" || (u.Scheme == "http" && isLoopbackHost(u.Hostname()))
}

// redirectURIMatches compares exactly, except that a loopback callback may use
// any port (RFC 8252 section 7.3): native clients bind an ephemeral one.
func redirectURIMatches(registered, requested string) bool {
	if registered == requested {
		return true
	}
	r, err1 := url.Parse(registered)
	q, err2 := url.Parse(requested)
	if err1 != nil || err2 != nil || r.Scheme != "http" || q.Scheme != "http" {
		return false
	}
	return isLoopbackHost(r.Hostname()) && r.Hostname() == q.Hostname() &&
		r.Path == q.Path && r.RawQuery == q.RawQuery
}

func clientAllowsRedirect(client model.OAuthClient, redirectURI string) bool {
	var registered []string
	if err := json.Unmarshal([]byte(client.RedirectURIs), &registered); err != nil {
		return false
	}
	for _, r := range registered {
		if redirectURIMatches(r, redirectURI) {
			return true
		}
	}
	return false
}

// maxGrantableScope is the widest scope a request asked for; no scope means both.
func maxGrantableScope(requested string) (string, bool) {
	fields := strings.Fields(requested)
	if len(fields) == 0 {
		return model.ScopeMCPWrite, true
	}
	scope := ""
	for _, f := range fields {
		switch f {
		case model.ScopeMCPWrite:
			scope = model.ScopeMCPWrite
		case model.ScopeMCPRead:
			if scope == "" {
				scope = model.ScopeMCPRead
			}
		default:
			return "", false
		}
	}
	return scope, true
}

func verifyPKCE(challenge, verifier string) bool {
	if len(verifier) < 43 || len(verifier) > 128 {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(computed), []byte(challenge)) == 1
}

// OAuthMetadata serves RFC 8414 authorization server metadata.
func (h Handler) OAuthMetadata(c echo.Context) error {
	base := oauthPublicBaseURL(c)
	api := base + config.C.GetString(config.SERVER_API_ROOT_PATH) + "/oauth"
	return c.JSON(http.StatusOK, map[string]any{
		"issuer":                                base,
		"authorization_endpoint":                base + "/oauth/authorize",
		"token_endpoint":                        api + "/token",
		"registration_endpoint":                 api + "/register",
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
		"code_challenge_methods_supported":      []string{"S256"},
		"token_endpoint_auth_methods_supported": []string{"none"},
		"scopes_supported":                      []string{model.ScopeMCPRead, model.ScopeMCPWrite},
	})
}

type oauthRegisterRequest struct {
	ClientName   string   `json:"client_name"`
	RedirectURIs []string `json:"redirect_uris"`
}

func oauthRegisterError(c echo.Context, code, description string) error {
	return c.JSON(http.StatusBadRequest, map[string]string{"error": code, "error_description": description})
}

func decodeOAuthBody(c echo.Context, v any) error {
	return json.NewDecoder(http.MaxBytesReader(c.Response(), c.Request().Body, oauthMaxBodyBytes)).Decode(v)
}

// OAuthRegister implements dynamic client registration (RFC 7591) for public clients.
func (h Handler) OAuthRegister(c echo.Context) error {
	var req oauthRegisterRequest
	if err := decodeOAuthBody(c, &req); err != nil {
		return oauthRegisterError(c, "invalid_client_metadata", "malformed request body")
	}
	if len(req.RedirectURIs) == 0 || len(req.RedirectURIs) > oauthMaxRedirectURIs {
		return oauthRegisterError(c, "invalid_redirect_uri", "between 1 and 5 redirect_uris are required")
	}
	for _, uri := range req.RedirectURIs {
		if !validRedirectURI(uri) {
			return oauthRegisterError(c, "invalid_redirect_uri", "redirect_uris must be https or http on loopback")
		}
	}

	name := strings.TrimSpace(req.ClientName)
	if name == "" {
		name = "MCP client"
	}
	if runes := []rune(name); len(runes) > oauthMaxClientName {
		name = string(runes[:oauthMaxClientName])
	}

	uris, err := json.Marshal(req.RedirectURIs)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to register client")
	}

	now := time.Now().UTC()
	client := model.OAuthClient{
		ID:           util.NewId(),
		Name:         name,
		RedirectURIs: string(uris),
		CreatedAt:    now.Format(time.RFC3339),
	}
	if err := h.db.CreateOAuthClient(client); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to register client")
	}
	// Registration is open, so abandoned clients are swept as new ones arrive.
	_ = h.db.DeleteUnusedOAuthClients(now.Add(-oauthUnusedClientTTL).Format(time.RFC3339))

	c.Response().Header().Set("Cache-Control", "no-store")
	return c.JSON(http.StatusCreated, map[string]any{
		"client_id":                  client.ID,
		"client_id_issued_at":        now.Unix(),
		"client_name":                client.Name,
		"redirect_uris":              req.RedirectURIs,
		"grant_types":                []string{"authorization_code", "refresh_token"},
		"response_types":             []string{"code"},
		"token_endpoint_auth_method": "none",
	})
}

type oauthAuthorizeParams struct {
	ClientID            string `json:"client_id" query:"client_id"`
	RedirectURI         string `json:"redirect_uri" query:"redirect_uri"`
	ResponseType        string `json:"response_type" query:"response_type"`
	CodeChallenge       string `json:"code_challenge" query:"code_challenge"`
	CodeChallengeMethod string `json:"code_challenge_method" query:"code_challenge_method"`
	Scope               string `json:"scope" query:"scope"`
	Resource            string `json:"resource" query:"resource"`
	State               string `json:"state" query:"state"`
}

// checkAuthorizeParams validates a request before anything is shown or issued.
// Failures are never redirected: until the redirect_uri is verified it is untrusted.
func (h Handler) checkAuthorizeParams(c echo.Context, p oauthAuthorizeParams) (model.OAuthClient, string, error) {
	client, err := h.db.FindOAuthClient(p.ClientID)
	if err != nil {
		return client, "", echo.NewHTTPError(http.StatusBadRequest, "unknown client")
	}
	if !clientAllowsRedirect(client, p.RedirectURI) {
		return client, "", echo.NewHTTPError(http.StatusBadRequest, "redirect_uri is not registered for this client")
	}
	if p.ResponseType != "code" {
		return client, "", echo.NewHTTPError(http.StatusBadRequest, "response_type must be code")
	}
	if p.CodeChallenge == "" || p.CodeChallengeMethod != "S256" {
		return client, "", echo.NewHTTPError(http.StatusBadRequest, "PKCE with S256 is required")
	}
	if p.Resource != "" && strings.TrimRight(p.Resource, "/") != oauthPublicBaseURL(c)+"/mcp" {
		return client, "", echo.NewHTTPError(http.StatusBadRequest, "unknown resource")
	}
	maxScope, ok := maxGrantableScope(p.Scope)
	if !ok {
		return client, "", echo.NewHTTPError(http.StatusBadRequest, "unsupported scope")
	}
	return client, maxScope, nil
}

// OAuthAuthorizeInfo tells the consent page who is asking and for what.
func (h Handler) OAuthAuthorizeInfo(c echo.Context) error {
	var p oauthAuthorizeParams
	if err := (&echo.DefaultBinder{}).BindQueryParams(c, &p); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	client, maxScope, err := h.checkAuthorizeParams(c, p)
	if err != nil {
		return err
	}
	redirect, err := url.Parse(p.RedirectURI)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid redirect_uri")
	}
	return c.JSON(http.StatusOK, map[string]string{
		"client_name":   client.Name,
		"redirect_host": redirect.Host,
		"max_scope":     maxScope,
	})
}

type oauthDecisionRequest struct {
	oauthAuthorizeParams
	Approved     bool   `json:"approved"`
	GrantedScope string `json:"granted_scope"`
}

// OAuthAuthorizeDecision records the user's answer and returns where to send them.
// The session cookie is SameSite=Strict, so another site cannot submit this.
func (h Handler) OAuthAuthorizeDecision(c echo.Context) error {
	var req oauthDecisionRequest
	if err := decodeOAuthBody(c, &req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "malformed request body")
	}
	_, maxScope, err := h.checkAuthorizeParams(c, req.oauthAuthorizeParams)
	if err != nil {
		return err
	}

	user, ok := c.Get("user").(model.User)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "please login")
	}

	redirect, err := url.Parse(req.RedirectURI)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid redirect_uri")
	}
	query := redirect.Query()
	if req.State != "" {
		query.Set("state", req.State)
	}
	query.Set("iss", oauthPublicBaseURL(c))

	if !req.Approved {
		query.Set("error", "access_denied")
		redirect.RawQuery = query.Encode()
		return c.JSON(http.StatusOK, map[string]string{"redirect_to": redirect.String()})
	}

	scope := req.GrantedScope
	if scope != model.ScopeMCPRead && scope != model.ScopeMCPWrite {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid granted_scope")
	}
	if maxScope == model.ScopeMCPRead && scope == model.ScopeMCPWrite {
		return echo.NewHTTPError(http.StatusBadRequest, "granted_scope exceeds the requested scope")
	}

	code, err := oauthRandomToken("")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue code")
	}
	_ = h.db.DeleteExpiredOAuthData(oauthNow())
	if err := h.db.CreateOAuthCode(model.OAuthCode{
		CodeHash:      oauthHash(code),
		ClientID:      req.ClientID,
		UserID:        user.ID,
		RedirectURI:   req.RedirectURI,
		CodeChallenge: req.CodeChallenge,
		Scope:         scope,
		ExpiresAt:     time.Now().UTC().Add(oauthCodeTTL).Format(time.RFC3339),
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue code")
	}

	query.Set("code", code)
	redirect.RawQuery = query.Encode()
	return c.JSON(http.StatusOK, map[string]string{"redirect_to": redirect.String()})
}

func oauthTokenError(c echo.Context, code, description string) error {
	c.Response().Header().Set("Cache-Control", "no-store")
	return c.JSON(http.StatusBadRequest, map[string]string{"error": code, "error_description": description})
}

// issueAccessToken creates the API key row behind an OAuth access token.
func (h Handler) issueAccessToken(grant model.OAuthGrant, clientName string) (string, error) {
	fullKey, prefix, err := util.GenerateAPIKey()
	if err != nil {
		return "", err
	}
	keyHash, err := bcrypt.GenerateFromPassword([]byte(fullKey), 12)
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	err = h.db.CreateAPIKey(model.APIKey{
		ID:        util.NewId(),
		UserID:    grant.UserID,
		Name:      clientName,
		KeyHash:   string(keyHash),
		Prefix:    prefix,
		ExpiresAt: now.Add(oauthAccessTokenTTL).Format(time.RFC3339),
		CreatedAt: now.Format(time.RFC3339),
		CreatedBy: grant.UserID,
		Scope:     grant.Scope,
		GrantID:   grant.ID,
	})
	return fullKey, err
}

func (h Handler) oauthTokenResponse(c echo.Context, grant model.OAuthGrant, client model.OAuthClient, refreshToken string) error {
	accessToken, err := h.issueAccessToken(grant, client.Name)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue token")
	}
	c.Response().Header().Set("Cache-Control", "no-store")
	return c.JSON(http.StatusOK, map[string]any{
		"access_token":  accessToken,
		"token_type":    "Bearer",
		"expires_in":    int(oauthAccessTokenTTL.Seconds()),
		"refresh_token": refreshToken,
		"scope":         grant.Scope,
	})
}

// OAuthToken is the token endpoint: authorization_code and refresh_token grants.
func (h Handler) OAuthToken(c echo.Context) error {
	client, err := h.db.FindOAuthClient(c.FormValue("client_id"))
	if err != nil {
		c.Response().Header().Set("Cache-Control", "no-store")
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid_client", "error_description": "unknown client"})
	}

	switch c.FormValue("grant_type") {
	case "authorization_code":
		return h.oauthExchangeCode(c, client)
	case "refresh_token":
		return h.oauthRefresh(c, client)
	default:
		return oauthTokenError(c, "unsupported_grant_type", "grant_type must be authorization_code or refresh_token")
	}
}

func (h Handler) oauthExchangeCode(c echo.Context, client model.OAuthClient) error {
	code, err := h.db.ConsumeOAuthCode(oauthHash(c.FormValue("code")))
	if err != nil {
		return oauthTokenError(c, "invalid_grant", "authorization code is invalid or already used")
	}
	if code.ClientID != client.ID || code.RedirectURI != c.FormValue("redirect_uri") {
		return oauthTokenError(c, "invalid_grant", "authorization code was issued to another client")
	}
	if code.ExpiresAt < oauthNow() {
		return oauthTokenError(c, "invalid_grant", "authorization code has expired")
	}
	if !verifyPKCE(code.CodeChallenge, c.FormValue("code_verifier")) {
		return oauthTokenError(c, "invalid_grant", "code_verifier does not match")
	}

	refreshToken, err := oauthRandomToken("ntr_")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue token")
	}
	now := time.Now().UTC()
	grant := model.OAuthGrant{
		ID:          util.NewId(),
		ClientID:    client.ID,
		UserID:      code.UserID,
		Scope:       code.Scope,
		RefreshHash: oauthHash(refreshToken),
		CreatedAt:   now.Format(time.RFC3339),
		LastUsedAt:  now.Format(time.RFC3339),
		ExpiresAt:   now.Add(oauthRefreshTokenTTL).Format(time.RFC3339),
	}
	if err := h.db.CreateOAuthGrant(grant); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue token")
	}
	return h.oauthTokenResponse(c, grant, client, refreshToken)
}

func (h Handler) oauthRefresh(c echo.Context, client model.OAuthClient) error {
	oldHash := oauthHash(c.FormValue("refresh_token"))

	grant, err := h.db.FindOAuthGrantByRefreshHash(oldHash)
	if err != nil {
		// A rotated-out token coming back means it leaked: end the whole connection.
		if replayed, findErr := h.db.FindOAuthGrantByPrevRefreshHash(oldHash); findErr == nil {
			_ = h.db.DeleteOAuthGrant(replayed.ID)
		}
		return oauthTokenError(c, "invalid_grant", "refresh token is invalid")
	}
	if grant.ClientID != client.ID {
		return oauthTokenError(c, "invalid_grant", "refresh token was issued to another client")
	}
	if grant.ExpiresAt < oauthNow() {
		_ = h.db.DeleteOAuthGrant(grant.ID)
		return oauthTokenError(c, "invalid_grant", "refresh token has expired")
	}
	user, err := h.db.FindUserByID(grant.UserID)
	if err != nil || user.Disabled {
		return oauthTokenError(c, "invalid_grant", "user is not available")
	}

	refreshToken, err := oauthRandomToken("ntr_")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue token")
	}
	now := time.Now().UTC()
	rotated, err := h.db.RotateOAuthGrant(
		grant.ID, oldHash, oauthHash(refreshToken),
		now.Format(time.RFC3339), now.Add(oauthRefreshTokenTTL).Format(time.RFC3339),
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue token")
	}
	if !rotated {
		return oauthTokenError(c, "invalid_grant", "refresh token is invalid")
	}
	_ = h.db.DeleteExpiredOAuthData(oauthNow())
	return h.oauthTokenResponse(c, grant, client, refreshToken)
}

// OAuthTokenInfo lets the MCP server check a bearer token before serving a request.
func (h Handler) OAuthTokenInfo(c echo.Context) error {
	user, ok := c.Get("user").(model.User)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
	}
	scope, _ := c.Get("apiKeyScope").(string)
	return c.JSON(http.StatusOK, map[string]string{"user_id": user.ID, "user_name": user.Name, "scope": scope})
}

// ListOAuthGrants returns the applications a user has connected.
func (h Handler) ListOAuthGrants(c echo.Context) error {
	userID := c.Param("id")
	user, ok := c.Get("user").(model.User)
	if !ok || user.ID != userID {
		return echo.NewHTTPError(http.StatusForbidden, "you can only manage your own connections")
	}
	grants, err := h.db.FindOAuthGrantsByUser(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch connections")
	}
	res := make([]model.OAuthGrantResponse, 0, len(grants))
	for _, g := range grants {
		item := model.OAuthGrantResponse{ID: g.ID, Scope: g.Scope, CreatedAt: g.CreatedAt, LastUsedAt: g.LastUsedAt}
		if client, err := h.db.FindOAuthClient(g.ClientID); err == nil {
			item.ClientName = client.Name
		}
		res = append(res, item)
	}
	return c.JSON(http.StatusOK, res)
}

// DeleteOAuthGrant disconnects an application and revokes its tokens at once.
func (h Handler) DeleteOAuthGrant(c echo.Context) error {
	userID := c.Param("id")
	user, ok := c.Get("user").(model.User)
	if !ok || user.ID != userID {
		return echo.NewHTTPError(http.StatusForbidden, "you can only manage your own connections")
	}
	grant, err := h.db.FindOAuthGrantByID(c.Param("grantId"))
	if err != nil || grant.UserID != userID {
		return echo.NewHTTPError(http.StatusNotFound, "connection not found")
	}
	if err := h.db.DeleteOAuthGrant(grant.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to remove connection")
	}
	return c.NoContent(http.StatusNoContent)
}
