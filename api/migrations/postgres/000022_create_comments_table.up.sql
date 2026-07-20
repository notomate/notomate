CREATE TABLE comments (
    id VARCHAR(255),
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255) NOT NULL,
    quoted_text TEXT NOT NULL,
    body TEXT NOT NULL,
    edited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT fk_comments_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_comments_note_id ON comments(note_id);
CREATE INDEX idx_comments_thread_id ON comments(thread_id);
