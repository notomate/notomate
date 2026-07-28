CREATE TABLE messages (
    id VARCHAR(255),
    workspace_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    edited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT fk_messages_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
