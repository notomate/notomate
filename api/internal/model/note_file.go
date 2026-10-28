package model

// NoteFile records that a workspace file is used by a note, either in the
// note's own content or in one of its comments.
type NoteFile struct {
	WorkspaceID string
	NoteID      string
	// CommentID is the comment the file appears in, or "" for the note's content.
	CommentID string
	FileName  string
}
