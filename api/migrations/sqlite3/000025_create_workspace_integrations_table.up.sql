CREATE TABLE `workspace_integrations` (
    `id` text,
    `workspace_id` text NOT NULL,
    `provider` text NOT NULL,
    `config_encrypted` text NOT NULL,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `uni_workspace_integrations_workspace_provider` UNIQUE (`workspace_id`, `provider`),
    CONSTRAINT `fk_workspace_integrations_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);
