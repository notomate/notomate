CREATE TABLE `workflows` (
    `id` text,
    `workspace_id` text NOT NULL,
    `name` text NOT NULL,
    `definition` text NOT NULL,
    `enabled` integer NOT NULL DEFAULT 1,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_workflows_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_workflows_workspace_id` ON `workflows`(`workspace_id`);
