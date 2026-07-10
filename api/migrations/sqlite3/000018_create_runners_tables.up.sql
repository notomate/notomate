CREATE TABLE `runners` (
    `id` text,
    `name` text NOT NULL,
    `labels` text NOT NULL,
    `token_hash` text NOT NULL,
    `version` text,
    `status` text NOT NULL DEFAULT 'offline',
    `last_online_at` text,
    `created_at` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `uni_runners_token_hash` UNIQUE (`token_hash`)
);

CREATE INDEX `idx_runners_token_hash` ON `runners`(`token_hash`);

CREATE TABLE `settings` (
    `key` text,
    `value` text NOT NULL,
    `updated_at` text,
    PRIMARY KEY (`key`)
);
