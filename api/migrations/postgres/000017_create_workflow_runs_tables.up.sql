CREATE TABLE workflow_runs (
    id VARCHAR(255),
    workflow_id VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    run_number INTEGER NOT NULL,
    event VARCHAR(50) NOT NULL,
    event_payload TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    triggered_by VARCHAR(255),
    created_at TEXT,
    started_at TEXT,
    finished_at TEXT,
    PRIMARY KEY (id),
    CONSTRAINT fk_workflow_runs_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs (workflow_id);
CREATE INDEX idx_workflow_runs_workspace_id ON workflow_runs (workspace_id);

CREATE TABLE workflow_jobs (
    id VARCHAR(255),
    run_id VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    runs_on TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    runner_id VARCHAR(255),
    created_at TEXT,
    started_at TEXT,
    finished_at TEXT,
    PRIMARY KEY (id),
    CONSTRAINT fk_workflow_jobs_run FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_jobs_run_id ON workflow_jobs (run_id);
CREATE INDEX idx_workflow_jobs_status ON workflow_jobs (status);

CREATE TABLE workflow_job_logs (
    job_id VARCHAR(255) NOT NULL,
    line_no INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT,
    PRIMARY KEY (job_id, line_no),
    CONSTRAINT fk_workflow_job_logs_job FOREIGN KEY (job_id) REFERENCES workflow_jobs(id) ON DELETE CASCADE
);
