CREATE TABLE `workflow_vars` (
    `id` text,
    `workspace_id` text NOT NULL,
    `key` text NOT NULL,
    `value` text NOT NULL,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `uni_workflow_vars_workspace_key` UNIQUE (`workspace_id`, `key`),
    CONSTRAINT `fk_workflow_vars_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_workflow_vars_workspace_id` ON `workflow_vars`(`workspace_id`);

CREATE TABLE `workflow_secrets` (
    `id` text,
    `workspace_id` text NOT NULL,
    `key` text NOT NULL,
    `value_encrypted` text NOT NULL,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `uni_workflow_secrets_workspace_key` UNIQUE (`workspace_id`, `key`),
    CONSTRAINT `fk_workflow_secrets_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_workflow_secrets_workspace_id` ON `workflow_secrets`(`workspace_id`);
