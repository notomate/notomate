-- NULL until the search indexer has processed the note's current content;
-- every note update resets it to NULL.
ALTER TABLE notes ADD COLUMN search_indexed_at TEXT NULL;
CREATE INDEX idx_notes_search_indexed_at ON notes (search_indexed_at);

-- Normalized searchable text of a note: title, content text, tags,
-- locations, block attributes and comments.
CREATE TABLE note_search (
    note_id VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (note_id)
);
CREATE INDEX idx_note_search_workspace ON note_search (workspace_id);

CREATE TABLE note_tags (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    tag VARCHAR(255) NOT NULL,
    tag_norm VARCHAR(255) NOT NULL,
    PRIMARY KEY (note_id, tag_norm)
);
CREATE INDEX idx_note_tags_workspace_tag ON note_tags (workspace_id, tag_norm);

CREATE TABLE note_locations (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    seq INTEGER NOT NULL,
    source VARCHAR(64) NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (note_id, seq)
);
CREATE INDEX idx_note_locations_workspace_lat_lng ON note_locations (workspace_id, lat, lng);
