CREATE TABLE google_maps_cache (
    cache_key VARCHAR(64),
    workspace_id VARCHAR(255) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    ref TEXT,
    response TEXT NOT NULL,
    content_type VARCHAR(255),
    created_at TEXT,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (cache_key),
    CONSTRAINT fk_google_maps_cache_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_google_maps_cache_workspace_kind_ref ON google_maps_cache (workspace_id, kind, ref);
CREATE INDEX idx_google_maps_cache_expires_at ON google_maps_cache (expires_at);
