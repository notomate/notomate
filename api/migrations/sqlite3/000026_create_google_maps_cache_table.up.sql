CREATE TABLE `google_maps_cache` (
    `cache_key` text,
    `workspace_id` text NOT NULL,
    `kind` text NOT NULL,
    `ref` text,
    `response` text NOT NULL,
    `content_type` text,
    `created_at` text,
    `expires_at` text NOT NULL,
    PRIMARY KEY (`cache_key`),
    CONSTRAINT `fk_google_maps_cache_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_google_maps_cache_workspace_kind_ref` ON `google_maps_cache`(`workspace_id`, `kind`, `ref`);
CREATE INDEX `idx_google_maps_cache_expires_at` ON `google_maps_cache`(`expires_at`);
