CREATE TABLE widgets (
    workspace_id VARCHAR(255),
    id VARCHAR(255),
    type VARCHAR(50),
    config MEDIUMTEXT,
    position TEXT,
    parent_id VARCHAR(255),
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT fk_widgets_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_widgets_parent FOREIGN KEY (parent_id) REFERENCES widgets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_widgets_workspace_id ON widgets(workspace_id);
CREATE INDEX idx_widgets_type ON widgets(type);
CREATE INDEX idx_widgets_parent_id ON widgets(parent_id);
