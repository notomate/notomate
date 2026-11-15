-- Structured block content for search filters, filled by the search indexer.

-- Node types a note contains, with how many of each.
CREATE TABLE note_blocks (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    count INT NOT NULL,
    PRIMARY KEY (note_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE INDEX idx_note_blocks_workspace_type ON note_blocks (workspace_id, type);

-- Calendar block dates (YYYY-MM-DD).
CREATE TABLE note_events (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    seq INT NOT NULL,
    date VARCHAR(10) NOT NULL,
    title TEXT NOT NULL,
    PRIMARY KEY (note_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_note_events_workspace_date ON note_events (workspace_id, date);

-- Rating block values; max_rating varies per block.
CREATE TABLE note_ratings (
    workspace_id VARCHAR(255) NOT NULL,
    note_id VARCHAR(255) NOT NULL,
    seq INT NOT NULL,
    rating DOUBLE NOT NULL,
    max_rating DOUBLE NOT NULL,
    label TEXT NOT NULL,
    PRIMARY KEY (note_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- To-do items of the note, open and checked.
ALTER TABLE note_search ADD COLUMN tasks_open INT NOT NULL DEFAULT 0;
ALTER TABLE note_search ADD COLUMN tasks_done INT NOT NULL DEFAULT 0;

-- Rebuild every note's index so the new tables are filled.
UPDATE notes SET search_indexed_at = NULL;
