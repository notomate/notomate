CREATE TABLE `note_files` (
    `workspace_id` text NOT NULL,
    `note_id` text NOT NULL,
    `comment_id` text NOT NULL DEFAULT '',
    `file_name` text NOT NULL,
    PRIMARY KEY (`note_id`, `comment_id`, `file_name`)
);

CREATE INDEX `idx_note_files_workspace_file` ON `note_files`(`workspace_id`, `file_name`);
CREATE INDEX `idx_note_files_comment_id` ON `note_files`(`comment_id`);

-- One row per completed one-off data backfill, so each runs only once.
CREATE TABLE `backfills` (
    `name` text,
    `completed_at` text NOT NULL,
    PRIMARY KEY (`name`)
);
