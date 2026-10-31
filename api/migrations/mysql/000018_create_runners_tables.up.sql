CREATE TABLE runners (
    id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    labels TEXT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'offline',
    last_online_at TEXT,
    created_at TEXT,
    PRIMARY KEY (id),
    CONSTRAINT uni_runners_token_hash UNIQUE (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_runners_token_hash ON runners (token_hash);

CREATE TABLE settings (
    `key` VARCHAR(255),
    value MEDIUMTEXT NOT NULL,
    updated_at TEXT,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
