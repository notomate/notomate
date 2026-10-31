-- No foreign key: root notes store parent_id as '' rather than NULL, which
-- InnoDB would reject. Orphaned children are handled by the application.
ALTER TABLE notes ADD COLUMN parent_id VARCHAR(255);
