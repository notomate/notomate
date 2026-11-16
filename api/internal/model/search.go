package model

// NoteSearch is a note's normalized searchable text (see internal/search).
type NoteSearch struct {
	NoteID      string `gorm:"primaryKey"`
	WorkspaceID string
	Body        string
	TasksOpen   int // unchecked to-do items
	TasksDone   int // checked to-do items
}

func (NoteSearch) TableName() string { return "note_search" }

// NoteTag is one tag of a note. TagNorm is the normalized form used for
// matching; Tag keeps the spelling shown to users.
type NoteTag struct {
	WorkspaceID string `json:"-"`
	NoteID      string `json:"-" gorm:"primaryKey"`
	Tag         string `json:"tag"`
	TagNorm     string `json:"-" gorm:"primaryKey"`
}

// NoteLocation is one coordinate found in a note: a location block, a Google
// map marker, place or route waypoint.
type NoteLocation struct {
	WorkspaceID string  `json:"-"`
	NoteID      string  `json:"-" gorm:"primaryKey"`
	Seq         int     `json:"-" gorm:"primaryKey;autoIncrement:false"`
	Source      string  `json:"source"`
	Name        string  `json:"name"`
	Address     string  `json:"address"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
}

// NoteBlock counts the nodes of one type in a note (e.g. "image": 3).
type NoteBlock struct {
	WorkspaceID string `json:"-"`
	NoteID      string `json:"-" gorm:"primaryKey"`
	Type        string `json:"type" gorm:"primaryKey"`
	Count       int    `json:"count"`
}

// NoteEvent is the date of a calendar block, as YYYY-MM-DD.
type NoteEvent struct {
	WorkspaceID string `json:"-"`
	NoteID      string `json:"-" gorm:"primaryKey"`
	Seq         int    `json:"-" gorm:"primaryKey;autoIncrement:false"`
	Date        string `json:"date"`
	Title       string `json:"title"`
}

// NoteRating is the value of a rating block, out of MaxRating stars.
type NoteRating struct {
	WorkspaceID string  `json:"-"`
	NoteID      string  `json:"-" gorm:"primaryKey"`
	Seq         int     `json:"-" gorm:"primaryKey;autoIncrement:false"`
	Rating      float64 `json:"rating"`
	MaxRating   float64 `json:"max_rating"`
	Label       string  `json:"label"`
}

// NoteSearchIndex is everything the indexer stores for one note.
type NoteSearchIndex struct {
	Body      string
	Tags      []NoteTag
	Locations []NoteLocation
	Blocks    []NoteBlock
	Events    []NoteEvent
	Ratings   []NoteRating
	TasksOpen int
	TasksDone int
}

// BBox is a coordinate range. MinLng > MaxLng means the box crosses the
// antimeridian.
type BBox struct {
	MinLng, MinLat, MaxLng, MaxLat float64
}

type SearchFilter struct {
	WorkspaceID string
	UserID      string   // viewer; private notes of others are hidden
	Terms       []string // normalized keywords, all must match
	Tags        []string // normalized tags
	MatchAnyTag bool     // default: a note must have every tag
	BBox        *BBox
	ParentID    string // "null" for root notes
	PinnedOnly  bool
	CreatedBy   string
	SortBy      string // "updated_at" or "created_at" (default)
	SortAsc     bool   // oldest first; newest first by default
	// BlockTypes, DateField, DateFrom and DateTo work as in NoteFilter, but
	// block types are matched against the index.
	BlockTypes []string
	DateField  string
	DateFrom   string
	DateTo     string
	// EventFrom and EventTo keep notes with a calendar block dated within
	// them, inclusive YYYY-MM-DD; either may be empty.
	EventFrom string
	EventTo   string
	// Tasks is "open" for notes with an unchecked to-do item, "done" for
	// notes whose to-do items are all checked.
	Tasks string
	// MinRating keeps notes with a rating block of at least this many stars
	// out of 5 (blocks with another maximum are scaled); 0 means no filter.
	MinRating  float64
	PageSize   int
	PageNumber int
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}
