CREATE TABLE `messages` (
    `id` text,
    `workspace_id` text NOT NULL,
    `channel_id` text NOT NULL,
    `body` text NOT NULL,
    `edited` boolean NOT NULL DEFAULT 0,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_messages_channel` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_messages_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX `idx_messages_channel_id` ON `messages`(`channel_id`);
