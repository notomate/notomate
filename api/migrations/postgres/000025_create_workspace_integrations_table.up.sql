CREATE TABLE workspace_integrations (
    id VARCHAR(255),
    workspace_id VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    config_encrypted TEXT NOT NULL,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT uni_workspace_integrations_workspace_provider UNIQUE (workspace_id, provider),
    CONSTRAINT fk_workspace_integrations_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
