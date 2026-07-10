CREATE TABLE workflow_vars (
    id VARCHAR(255),
    workspace_id VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT uni_workflow_vars_workspace_key UNIQUE (workspace_id, key),
    CONSTRAINT fk_workflow_vars_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_vars_workspace_id ON workflow_vars (workspace_id);

CREATE TABLE workflow_secrets (
    id VARCHAR(255),
    workspace_id VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value_encrypted TEXT NOT NULL,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT uni_workflow_secrets_workspace_key UNIQUE (workspace_id, key),
    CONSTRAINT fk_workflow_secrets_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_secrets_workspace_id ON workflow_secrets (workspace_id);
