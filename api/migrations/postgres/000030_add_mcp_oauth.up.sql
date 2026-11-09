ALTER TABLE api_keys ADD COLUMN scope VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN grant_id VARCHAR(255) NOT NULL DEFAULT '';
CREATE INDEX idx_api_keys_grant_id ON api_keys (grant_id);

CREATE TABLE oauth_clients (
    id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    redirect_uris TEXT NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE oauth_codes (
    code_hash VARCHAR(64),
    client_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    redirect_uri TEXT NOT NULL,
    code_challenge VARCHAR(255) NOT NULL,
    scope VARCHAR(32) NOT NULL,
    expires_at VARCHAR(64) NOT NULL,
    PRIMARY KEY (code_hash)
);

CREATE TABLE oauth_grants (
    id VARCHAR(255),
    client_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    scope VARCHAR(32) NOT NULL,
    refresh_hash VARCHAR(64) NOT NULL,
    prev_refresh_hash VARCHAR(64) NOT NULL DEFAULT '',
    created_at VARCHAR(64) NOT NULL,
    last_used_at VARCHAR(64) NOT NULL DEFAULT '',
    expires_at VARCHAR(64) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uni_oauth_grants_refresh UNIQUE (refresh_hash),
    CONSTRAINT fk_oauth_grants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_oauth_grants_user_id ON oauth_grants (user_id);
CREATE INDEX idx_oauth_grants_client_id ON oauth_grants (client_id);
CREATE INDEX idx_oauth_grants_prev_refresh ON oauth_grants (prev_refresh_hash);
