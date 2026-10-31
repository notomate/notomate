-- No foreign key: views without a note store note_id as '' rather than NULL,
-- which InnoDB would reject.
ALTER TABLE views ADD COLUMN note_id VARCHAR(255);
