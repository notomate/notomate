-- NULL until the search indexer has processed the note's current content;
-- every note update resets it to NULL.
ALTER TABLE `notes` ADD COLUMN `search_indexed_at` text NULL;
CREATE INDEX `idx_notes_search_indexed_at` ON `notes`(`search_indexed_at`);

-- Normalized searchable text of a note: title, content text, tags,
-- locations, block attributes and comments.
CREATE TABLE `note_search` (
    `note_id` text NOT NULL,
    `workspace_id` text NOT NULL,
    `body` text NOT NULL,
    PRIMARY KEY (`note_id`)
);
CREATE INDEX `idx_note_search_workspace` ON `note_search`(`workspace_id`);

CREATE TABLE `note_tags` (
    `workspace_id` text NOT NULL,
    `note_id` text NOT NULL,
    `tag` text NOT NULL,
    `tag_norm` text NOT NULL,
    PRIMARY KEY (`note_id`, `tag_norm`)
);
CREATE INDEX `idx_note_tags_workspace_tag` ON `note_tags`(`workspace_id`, `tag_norm`);

CREATE TABLE `note_locations` (
    `workspace_id` text NOT NULL,
    `note_id` text NOT NULL,
    `seq` integer NOT NULL,
    `source` text NOT NULL,
    `name` text NOT NULL DEFAULT '',
    `address` text NOT NULL DEFAULT '',
    `lat` real NOT NULL,
    `lng` real NOT NULL,
    PRIMARY KEY (`note_id`, `seq`)
);
CREATE INDEX `idx_note_locations_workspace_lat_lng` ON `note_locations`(`workspace_id`, `lat`, `lng`);
