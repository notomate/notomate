CREATE TABLE view_objects (
    id VARCHAR(255),
    view_id VARCHAR(255),
    name VARCHAR(255),
    type VARCHAR(50),
    data LONGTEXT,
    created_at TEXT,
    created_by VARCHAR(255),
    updated_at TEXT,
    updated_by VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT fk_view_objects_view FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
