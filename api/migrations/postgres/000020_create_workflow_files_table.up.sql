CREATE TABLE workflow_files (
    id VARCHAR(255),
    workspace_id VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT uni_workflow_files_workspace_path UNIQUE (workspace_id, path),
    CONSTRAINT fk_workflow_files_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_files_workspace_id ON workflow_files (workspace_id);
