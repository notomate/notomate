CREATE TABLE workflows (
    id VARCHAR(255),
    workspace_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    definition TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT fk_workflows_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflows_workspace_id ON workflows (workspace_id);
