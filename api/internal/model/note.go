package model

type NoteFilter struct {
	WorkspaceID string
	NoteIDs     string
	PageSize    int
	PageNumber  int
	UserID      string
	Query       string
	SortBy      string // "updated_at" or "created_at" (default)
	ParentID    string // filter by parent note id; use "null" to get root notes
	PinnedOnly  bool   // filter to only pinned notes
	CreatedBy   string // filter by creator user id
	// BlockTypes keeps notes whose content holds a node of any of these
	// TipTap types (e.g. "image", "taskList"). Names must be plain identifiers.
	BlockTypes []string
	DateField  string // "updated_at" or "created_at" (default); the column From/To apply to
	DateFrom   string // inclusive lower bound, UTC "2006-01-02T15:04:05"
	DateTo     string // exclusive upper bound, UTC "2006-01-02T15:04:05"
}

type Note struct {
	WorkspaceID string `json:"workspace_id"`
	ID          string `json:"id"`
	ParentID    string `json:"parent_id"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	Visibility  string `json:"visibility"`
	Pinned      bool   `json:"pinned"`
	CreatedAt   string `json:"created_at"`
	CreatedBy   string `json:"created_by"`
	UpdatedAt   string `json:"updated_at"`
	UpdatedBy   string `json:"updated_by"`
	// SearchIndexedAt is when the search indexer last processed this note's
	// content; nil means the index is missing or stale. UpdateNote always
	// resets it.
	SearchIndexedAt *string `json:"-"`
}
