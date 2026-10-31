CREATE TABLE action_sources (
    id VARCHAR(255),
    workspace_id VARCHAR(255) NOT NULL,
    owner VARCHAR(128) NOT NULL,
    repo VARCHAR(128) NOT NULL,
    ref VARCHAR(255) NOT NULL DEFAULT '',
    resolved_ref VARCHAR(255) NOT NULL DEFAULT '',
    resolved_sha VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(255) NOT NULL,
    last_error TEXT NOT NULL DEFAULT (''),
    last_synced_at TEXT,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT uni_action_sources_workspace_repo_ref UNIQUE (workspace_id, owner, repo, ref),
    CONSTRAINT fk_action_sources_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_action_sources_workspace_id ON action_sources (workspace_id);

CREATE TABLE marketplace_actions (
    id VARCHAR(255),
    source_id VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    uses TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT (''),
    author TEXT NOT NULL DEFAULT (''),
    icon VARCHAR(255) NOT NULL DEFAULT '',
    color VARCHAR(255) NOT NULL DEFAULT '',
    runs_using VARCHAR(255) NOT NULL DEFAULT '',
    inputs MEDIUMTEXT NOT NULL DEFAULT ('[]'),
    outputs MEDIUMTEXT NOT NULL DEFAULT ('[]'),
    created_at TEXT,
    PRIMARY KEY (id),
    CONSTRAINT fk_marketplace_actions_source FOREIGN KEY (source_id) REFERENCES action_sources(id) ON DELETE CASCADE,
    CONSTRAINT fk_marketplace_actions_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_marketplace_actions_source_id ON marketplace_actions (source_id);
CREATE INDEX idx_marketplace_actions_workspace_id ON marketplace_actions (workspace_id);
