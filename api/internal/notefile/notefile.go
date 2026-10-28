// Package notefile keeps the note_files table in step with note content and
// comments: which workspace files each note uses. File downloads use it to
// let anyone fetch files shown in public notes, and the files page uses it to
// list the notes a file appears in.
package notefile

import (
	"log"
	"regexp"
	"sort"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
)

// Matches a workspace file URL as the editor writes it,
// e.g. /api/v1/workspaces/<workspace>/files/<stored name>.
var fileURL = regexp.MustCompile(`/workspaces/([^/"'\s\\]+)/files/([^/?#"'\s\\)<>]+)`)

// Extract returns the stored names of the workspace's files referenced in
// content (note JSON or comment markdown), sorted and without duplicates.
// Files of other workspaces are ignored.
func Extract(workspaceID, content string) []string {
	seen := map[string]struct{}{}
	for _, m := range fileURL.FindAllStringSubmatch(content, -1) {
		if m[1] == workspaceID {
			seen[m[2]] = struct{}{}
		}
	}
	names := make([]string, 0, len(seen))
	for name := range seen {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// SyncNote records the files used by a note's content. Errors are logged
// rather than returned: a failed sync must not fail the note save.
func SyncNote(database db.DB, note model.Note) {
	if err := database.ReplaceNoteFiles(note.WorkspaceID, note.ID, "", Extract(note.WorkspaceID, note.Content)); err != nil {
		log.Printf("[notefile] sync note %s: %v", note.ID, err)
	}
}

// SyncComment records the files used by a comment.
func SyncComment(database db.DB, comment model.Comment) {
	if err := database.ReplaceNoteFiles(comment.WorkspaceID, comment.NoteID, comment.ID, Extract(comment.WorkspaceID, comment.Body)); err != nil {
		log.Printf("[notefile] sync comment %s: %v", comment.ID, err)
	}
}

// RemoveNote forgets every file used by a note and its comments.
func RemoveNote(database db.DB, noteID string) {
	if err := database.DeleteNoteFiles(noteID); err != nil {
		log.Printf("[notefile] remove note %s: %v", noteID, err)
	}
}

// RemoveComment forgets the files used by a comment.
func RemoveComment(database db.DB, commentID string) {
	if err := database.DeleteCommentFiles(commentID); err != nil {
		log.Printf("[notefile] remove comment %s: %v", commentID, err)
	}
}
