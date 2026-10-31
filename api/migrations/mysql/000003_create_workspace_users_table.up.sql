CREATE TABLE workspace_users (
    user_id VARCHAR(255),
    workspace_id VARCHAR(255),
    role VARCHAR(50),
    created_by VARCHAR(255),
    created_at TEXT,
    updated_at TEXT,
    updated_by VARCHAR(255),
    CONSTRAINT fk_workspace_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_users_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
