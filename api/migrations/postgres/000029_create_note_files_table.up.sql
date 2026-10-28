CREATE TABLE note_files (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    comment_id VARCHAR(255) NOT NULL DEFAULT '',
    file_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (note_id, comment_id, file_name)
);

CREATE INDEX idx_note_files_workspace_file ON note_files (workspace_id, file_name);
CREATE INDEX idx_note_files_comment_id ON note_files (comment_id);

-- One row per completed one-off data backfill, so each runs only once.
CREATE TABLE backfills (
    name VARCHAR(255),
    completed_at TEXT NOT NULL,
    PRIMARY KEY (name)
);
