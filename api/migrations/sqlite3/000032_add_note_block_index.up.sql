-- Structured block content for search filters, filled by the search indexer.

-- Node types a note contains, with how many of each.
CREATE TABLE `note_blocks` (
    `workspace_id` text NOT NULL,
    `note_id` text NOT NULL,
    `type` text NOT NULL,
    `count` integer NOT NULL,
    PRIMARY KEY (`note_id`, `type`)
);
CREATE INDEX `idx_note_blocks_workspace_type` ON `note_blocks`(`workspace_id`, `type`);

-- Calendar block dates (YYYY-MM-DD).
CREATE TABLE `note_events` (
    `workspace_id` text NOT NULL,
    `note_id` text NOT NULL,
    `seq` integer NOT NULL,
    `date` text NOT NULL,
    `title` text NOT NULL DEFAULT '',
    PRIMARY KEY (`note_id`, `seq`)
);
CREATE INDEX `idx_note_events_workspace_date` ON `note_events`(`workspace_id`, `date`);

-- Rating block values; max_rating varies per block.
CREATE TABLE `note_ratings` (
    `workspace_id` text NOT NULL,
    `note_id` text NOT NULL,
    `seq` integer NOT NULL,
    `rating` real NOT NULL,
    `max_rating` real NOT NULL,
    `label` text NOT NULL DEFAULT '',
    PRIMARY KEY (`note_id`, `seq`)
);

-- To-do items of the note, open and checked.
ALTER TABLE `note_search` ADD COLUMN `tasks_open` integer NOT NULL DEFAULT 0;
ALTER TABLE `note_search` ADD COLUMN `tasks_done` integer NOT NULL DEFAULT 0;

-- Rebuild every note's index so the new tables are filled.
UPDATE `notes` SET `search_indexed_at` = NULL;
