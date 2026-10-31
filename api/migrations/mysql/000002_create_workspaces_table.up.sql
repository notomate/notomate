CREATE TABLE workspaces (
    id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    created_by VARCHAR(255),
    created_at TEXT,
    updated_by VARCHAR(255),
    updated_at TEXT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
