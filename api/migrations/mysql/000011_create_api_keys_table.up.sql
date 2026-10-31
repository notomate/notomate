CREATE TABLE api_keys (
    id VARCHAR(255),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    key_hash TEXT NOT NULL,
    prefix VARCHAR(50) NOT NULL,
    last_used_at TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uni_api_keys_prefix UNIQUE (prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_api_keys_prefix ON api_keys (prefix);
CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
