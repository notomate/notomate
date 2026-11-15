-- Structured block content for search filters, filled by the search indexer.

-- Node types a note contains, with how many of each.
CREATE TABLE note_blocks (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (note_id, type)
);
CREATE INDEX idx_note_blocks_workspace_type ON note_blocks (workspace_id, type);

-- Calendar block dates (YYYY-MM-DD).
CREATE TABLE note_events (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    seq INTEGER NOT NULL,
    date VARCHAR(10) NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (note_id, seq)
);
CREATE INDEX idx_note_events_workspace_date ON note_events (workspace_id, date);

-- Rating block values; max_rating varies per block.
CREATE TABLE note_ratings (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    seq INTEGER NOT NULL,
    rating DOUBLE PRECISION NOT NULL,
    max_rating DOUBLE PRECISION NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (note_id, seq)
);

-- To-do items of the note, open and checked.
ALTER TABLE note_search ADD COLUMN tasks_open INTEGER NOT NULL DEFAULT 0;
ALTER TABLE note_search ADD COLUMN tasks_done INTEGER NOT NULL DEFAULT 0;

-- Rebuild every note's index so the new tables are filled.
UPDATE notes SET search_indexed_at = NULL;
