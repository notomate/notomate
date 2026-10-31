CREATE TABLE files (
    workspace_id VARCHAR(255) NOT NULL,
    id VARCHAR(255),
    name VARCHAR(255),
    original_filename VARCHAR(500),
    size BIGINT,
    ext VARCHAR(50),
    visibility VARCHAR(50),
    created_by VARCHAR(255),
    created_at TEXT,
    updated_by VARCHAR(255),
    updated_at TEXT,
    PRIMARY KEY (id),
    CONSTRAINT fk_files_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
