CREATE TABLE `channels` (
    `id` text,
    `workspace_id` text NOT NULL,
    `name` text NOT NULL,
    `description` text NOT NULL,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_channels_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);
CREATE INDEX `idx_channels_workspace_id` ON `channels`(`workspace_id`);
