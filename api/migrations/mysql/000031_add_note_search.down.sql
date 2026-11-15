DROP TABLE IF EXISTS note_locations;
DROP TABLE IF EXISTS note_tags;
DROP TABLE IF EXISTS note_search;
DROP INDEX idx_notes_search_indexed_at ON notes;
ALTER TABLE notes DROP COLUMN search_indexed_at;
