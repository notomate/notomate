DROP TABLE IF EXISTS `note_locations`;
DROP TABLE IF EXISTS `note_tags`;
DROP TABLE IF EXISTS `note_search`;
DROP INDEX IF EXISTS `idx_notes_search_indexed_at`;
ALTER TABLE `notes` DROP COLUMN `search_indexed_at`;
