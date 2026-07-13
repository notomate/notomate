CREATE TABLE `workflow_files` (
    `id` text,
    `workspace_id` text NOT NULL,
    `path` text NOT NULL,
    `storage_key` text NOT NULL,
    `size` integer NOT NULL DEFAULT 0,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `uni_workflow_files_workspace_path` UNIQUE (`workspace_id`, `path`),
    CONSTRAINT `fk_workflow_files_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_workflow_files_workspace_id` ON `workflow_files`(`workspace_id`);
