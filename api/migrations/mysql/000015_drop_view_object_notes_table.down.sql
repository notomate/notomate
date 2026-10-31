CREATE TABLE IF NOT EXISTS view_object_notes (
    view_object_id VARCHAR(255),
    note_id VARCHAR(255),
    created_at TEXT,
    created_by VARCHAR(255),
    PRIMARY KEY (view_object_id, note_id),
    CONSTRAINT fk_view_object_notes_view_object FOREIGN KEY (view_object_id) REFERENCES view_objects(id) ON DELETE CASCADE,
    CONSTRAINT fk_view_object_notes_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
