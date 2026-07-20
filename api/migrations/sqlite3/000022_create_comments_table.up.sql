CREATE TABLE `comments` (
    `id` text,
    `workspace_id` text NOT NULL,
    `note_id` text NOT NULL,
    `thread_id` text NOT NULL,
    `quoted_text` text NOT NULL,
    `body` text NOT NULL,
    `edited` boolean NOT NULL DEFAULT 0,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_comments_note` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_comments_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX `idx_comments_note_id` ON `comments`(`note_id`);
CREATE INDEX `idx_comments_thread_id` ON `comments`(`thread_id`);
