CREATE TABLE notes (
    workspace_id VARCHAR(255),
    id VARCHAR(255),
    title TEXT,
    content LONGTEXT,
    visibility VARCHAR(50),
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT fk_notes_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
