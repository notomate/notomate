CREATE TABLE `action_sources` (
    `id` text,
    `workspace_id` text NOT NULL,
    `owner` text NOT NULL,
    `repo` text NOT NULL,
    `ref` text NOT NULL DEFAULT '',
    `resolved_ref` text NOT NULL DEFAULT '',
    `resolved_sha` text NOT NULL DEFAULT '',
    `status` text NOT NULL,
    `last_error` text NOT NULL DEFAULT '',
    `last_synced_at` text,
    `created_at` text,
    `created_by` text,
    `updated_at` text,
    `updated_by` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `uni_action_sources_workspace_repo_ref` UNIQUE (`workspace_id`, `owner`, `repo`, `ref`),
    CONSTRAINT `fk_action_sources_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_action_sources_workspace_id` ON `action_sources`(`workspace_id`);

CREATE TABLE `marketplace_actions` (
    `id` text,
    `source_id` text NOT NULL,
    `workspace_id` text NOT NULL,
    `path` text NOT NULL,
    `uses` text NOT NULL,
    `name` text NOT NULL,
    `description` text NOT NULL DEFAULT '',
    `author` text NOT NULL DEFAULT '',
    `icon` text NOT NULL DEFAULT '',
    `color` text NOT NULL DEFAULT '',
    `runs_using` text NOT NULL DEFAULT '',
    `inputs` text NOT NULL DEFAULT '[]',
    `outputs` text NOT NULL DEFAULT '[]',
    `created_at` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_marketplace_actions_source` FOREIGN KEY (`source_id`) REFERENCES `action_sources`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_marketplace_actions_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_marketplace_actions_source_id` ON `marketplace_actions`(`source_id`);
CREATE INDEX `idx_marketplace_actions_workspace_id` ON `marketplace_actions`(`workspace_id`);
