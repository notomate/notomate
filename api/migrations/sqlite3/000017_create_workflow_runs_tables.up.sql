CREATE TABLE `workflow_runs` (
    `id` text,
    `workflow_id` text NOT NULL,
    `workspace_id` text NOT NULL,
    `run_number` integer NOT NULL,
    `event` text NOT NULL,
    `event_payload` text NOT NULL,
    `status` text NOT NULL,
    `triggered_by` text,
    `created_at` text,
    `started_at` text,
    `finished_at` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_workflow_runs_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_workflow_runs_workflow_id` ON `workflow_runs`(`workflow_id`);
CREATE INDEX `idx_workflow_runs_workspace_id` ON `workflow_runs`(`workspace_id`);

CREATE TABLE `workflow_jobs` (
    `id` text,
    `run_id` text NOT NULL,
    `workspace_id` text NOT NULL,
    `name` text NOT NULL,
    `runs_on` text NOT NULL,
    `status` text NOT NULL,
    `runner_id` text,
    `created_at` text,
    `started_at` text,
    `finished_at` text,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_workflow_jobs_run` FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE CASCADE
);

CREATE INDEX `idx_workflow_jobs_run_id` ON `workflow_jobs`(`run_id`);
CREATE INDEX `idx_workflow_jobs_status` ON `workflow_jobs`(`status`);

CREATE TABLE `workflow_job_logs` (
    `job_id` text NOT NULL,
    `line_no` integer NOT NULL,
    `content` text NOT NULL,
    `created_at` text,
    PRIMARY KEY (`job_id`, `line_no`),
    CONSTRAINT `fk_workflow_job_logs_job` FOREIGN KEY (`job_id`) REFERENCES `workflow_jobs`(`id`) ON DELETE CASCADE
);
