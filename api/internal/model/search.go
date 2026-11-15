package model

// NoteSearch is a note's normalized searchable text (see internal/search).
type NoteSearch struct {
	NoteID      string `gorm:"primaryKey"`
	WorkspaceID string
	Body        string
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

// NoteSearchIndex is everything the indexer stores for one note.
type NoteSearchIndex struct {
	Body      string
	Tags      []NoteTag
	Locations []NoteLocation
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
	// BlockTypes, DateField, DateFrom and DateTo work as in NoteFilter.
	BlockTypes []string
	DateField  string
	DateFrom   string
	DateTo     string
	PageSize   int
	PageNumber int
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}
