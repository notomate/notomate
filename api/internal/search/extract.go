// Package search builds the structured search index of notes: their
// normalized text, tags, coordinates, block types, calendar dates, ratings
// and to-do status. Notes whose search_indexed_at is NULL are picked up by
// a background scanner and handed to a pool of workers (see Indexer), so
// saving a note never waits for indexing.
package search

import (
	"encoding/json"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/notomate/notomate/internal/model"
	"golang.org/x/text/unicode/norm"
)

// maxTagRunes keeps tags within the indexed VARCHAR(255) columns.
const maxTagRunes = 100

// Normalize folds text for matching: NFKC (full-width to half-width and
// similar), lower case, and every whitespace run collapsed to one space.
// The index and the query terms both go through it.
func Normalize(s string) string {
	s = strings.ToLower(norm.NFKC.String(s))
	var b strings.Builder
	b.Grow(len(s))
	space := false
	for _, r := range s {
		if unicode.IsSpace(r) {
			space = true
			continue
		}
		if space && b.Len() > 0 {
			b.WriteByte(' ')
		}
		space = false
		b.WriteRune(r)
	}
	return b.String()
}

// NormalizeTag folds a tag the way the tags block does when it splits
// input: surrounding space and leading '#' removed, then Normalize.
func NormalizeTag(s string) string {
	s = Normalize(s)
	s = strings.TrimSpace(strings.TrimLeft(s, "#"))
	if utf8.RuneCountInString(s) > maxTagRunes {
		s = string([]rune(s)[:maxTagRunes])
	}
	return s
}

// Terms splits a query into normalized keywords.
func Terms(q string) []string {
	q = Normalize(q)
	if q == "" {
		return nil
	}
	return strings.Split(q, " ")
}

// Attribute keys whose values are identifiers, URLs or presentation
// settings rather than text a person would search for.
var skipAttrs = map[string]bool{
	"id": true, "src": true, "url": true, "uri": true, "href": true,
	"uploadId": true, "noteId": true, "viewId": true, "placeId": true, "pageId": true,
	"fetchedAt": true, "color": true, "textColor": true, "type": true, "viewType": true,
	"lang": true, "languageCode": true, "travelMode": true, "colwidth": true,
	"photoUri": true, "googleMapsUri": true, "websiteUri": true, "textAlign": true,
	"level": true, "language": true, "checked": true, "start": true,
}

type extractor struct {
	text      strings.Builder
	tags      []model.NoteTag
	seenTags  map[string]bool
	locations []model.NoteLocation
	blocks    map[string]int
	events    []model.NoteEvent
	ratings   []model.NoteRating
	tasksOpen int
	tasksDone int
}

// maxBlockType keeps node type names within the indexed VARCHAR(64).
const maxBlockType = 64

// Extract builds the index of a note from its title, its TipTap JSON
// content and the bodies of its comments.
func Extract(workspaceID, noteID, title, content string, comments []string) model.NoteSearchIndex {
	e := &extractor{seenTags: map[string]bool{}, blocks: map[string]int{}}
	e.write(title)
	e.sep()

	var doc any
	if content != "" {
		if err := json.Unmarshal([]byte(content), &doc); err == nil {
			e.walk(doc)
		} else {
			e.write(content)
		}
	}
	for _, c := range comments {
		e.sep()
		e.write(c)
	}

	for i := range e.tags {
		e.tags[i].WorkspaceID = workspaceID
		e.tags[i].NoteID = noteID
	}
	for i := range e.locations {
		e.locations[i].WorkspaceID = workspaceID
		e.locations[i].NoteID = noteID
		e.locations[i].Seq = i
	}
	for i := range e.events {
		e.events[i].WorkspaceID = workspaceID
		e.events[i].NoteID = noteID
		e.events[i].Seq = i
	}
	for i := range e.ratings {
		e.ratings[i].WorkspaceID = workspaceID
		e.ratings[i].NoteID = noteID
		e.ratings[i].Seq = i
	}
	blocks := make([]model.NoteBlock, 0, len(e.blocks))
	for typ, n := range e.blocks {
		blocks = append(blocks, model.NoteBlock{WorkspaceID: workspaceID, NoteID: noteID, Type: typ, Count: n})
	}
	sort.Slice(blocks, func(i, j int) bool { return blocks[i].Type < blocks[j].Type })
	return model.NoteSearchIndex{
		Body:      Normalize(e.text.String()),
		Tags:      e.tags,
		Locations: e.locations,
		Blocks:    blocks,
		Events:    e.events,
		Ratings:   e.ratings,
		TasksOpen: e.tasksOpen,
		TasksDone: e.tasksDone,
	}
}

func (e *extractor) write(s string) { e.text.WriteString(s) }

// sep ends a block, so words of neighbouring blocks don't run together.
func (e *extractor) sep() { e.text.WriteByte('\n') }

func (e *extractor) walk(v any) {
	switch x := v.(type) {
	case []any:
		for _, c := range x {
			e.walk(c)
		}
	case map[string]any:
		e.node(x)
	}
}

func (e *extractor) node(n map[string]any) {
	typ, _ := n["type"].(string)
	if typ == "text" {
		// Text nodes of one block are written back to back: marks split a
		// word into several nodes.
		if t, ok := n["text"].(string); ok {
			e.write(t)
		}
		return
	}
	e.sep()
	attrs, _ := n["attrs"].(map[string]any)
	if typ != "" && typ != "doc" && len(typ) <= maxBlockType {
		e.blocks[typ]++
	}
	switch typ {
	case "calendarNode":
		// The block's date input stores a plain YYYY-MM-DD day.
		if d := str(attrs["date"]); isDay(d) {
			e.events = append(e.events, model.NoteEvent{Date: d, Title: str(attrs["title"])})
		}
	case "ratingNode":
		rating, okRating := num(attrs["rating"])
		maxRating, okMax := num(attrs["maxRating"])
		if !okMax || maxRating <= 0 {
			maxRating = 5 // the block's default
		}
		// A new block starts at 0 with no label: nothing rated yet.
		if okRating && rating >= 0 && rating <= maxRating && (rating > 0 || str(attrs["label"]) != "") {
			e.ratings = append(e.ratings, model.NoteRating{Rating: rating, MaxRating: maxRating, Label: str(attrs["label"])})
		}
	case "taskItem":
		if checked, _ := attrs["checked"].(bool); checked {
			e.tasksDone++
		} else {
			e.tasksOpen++
		}
	}
	switch typ {
	case "tagsNode":
		if list, ok := attrs["tags"].([]any); ok {
			for _, t := range list {
				if s, ok := t.(string); ok {
					e.tag(s)
				}
			}
		}
	case "locationNode":
		e.location("locationNode", attrs["lat"], attrs["lng"], str(attrs["name"]), str(attrs["address"]))
	case "googleMapNode":
		e.text1(attrs["title"])
		for _, m := range list(attrs["markers"]) {
			e.location("googleMapNode", m["lat"], m["lng"], str(m["name"]), str(m["address"]))
			e.text1(m["note"])
		}
	case "googlePlacesNode":
		e.text1(attrs["query"])
		for _, p := range list(attrs["places"]) {
			loc, _ := p["location"].(map[string]any)
			e.location("googlePlacesNode", loc["latitude"], loc["longitude"], localized(p["displayName"]), str(p["formattedAddress"]))
			e.text1(localized(p["primaryTypeDisplayName"]))
			e.text1(localized(p["editorialSummary"]))
		}
	case "googleDirectionsNode":
		for _, w := range list(attrs["waypoints"]) {
			e.location("googleDirectionsNode", w["lat"], w["lng"], str(w["name"]), str(w["address"]))
		}
	default:
		if attrs != nil {
			e.attrs(attrs)
		}
	}
	e.walk(n["content"])
	e.sep()
}

// attrs indexes the text values of a block's attributes (calendar titles,
// file names, table cells, Wikipedia extracts, ...).
func (e *extractor) attrs(v any) {
	switch x := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(x))
		for k := range x {
			if !skipAttrs[k] {
				keys = append(keys, k)
			}
		}
		sort.Strings(keys) // stable body text across runs
		for _, k := range keys {
			e.attrs(x[k])
		}
	case []any:
		for _, val := range x {
			e.attrs(val)
		}
	case string:
		if !looksLikeURL(x) {
			e.text1(x)
		}
	}
}

func (e *extractor) text1(v any) {
	if s := str(v); s != "" {
		e.write(" " + s + " ")
	}
}

func (e *extractor) tag(raw string) {
	key := NormalizeTag(raw)
	if key == "" || e.seenTags[key] {
		return
	}
	e.seenTags[key] = true
	display := strings.TrimSpace(strings.TrimLeft(strings.TrimSpace(raw), "#"))
	if utf8.RuneCountInString(display) > maxTagRunes {
		display = string([]rune(display)[:maxTagRunes])
	}
	e.tags = append(e.tags, model.NoteTag{Tag: display, TagNorm: key})
	e.text1(display)
}

func (e *extractor) location(source string, lat, lng any, name, address string) {
	e.text1(name)
	e.text1(address)
	la, okLat := num(lat)
	lo, okLng := num(lng)
	if !okLat || !okLng || la < -90 || la > 90 || lo < -180 || lo > 180 {
		return
	}
	e.locations = append(e.locations, model.NoteLocation{Source: source, Name: name, Address: address, Lat: la, Lng: lo})
}

func str(v any) string {
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

// localized reads a Google LocalizedText ({text, languageCode}).
func localized(v any) string {
	m, _ := v.(map[string]any)
	return str(m["text"])
}

func list(v any) []map[string]any {
	items, _ := v.([]any)
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		if m, ok := it.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out
}

func num(v any) (float64, bool) {
	var f float64
	switch x := v.(type) {
	case float64:
		f = x
	case string:
		var err error
		if f, err = strconv.ParseFloat(strings.TrimSpace(x), 64); err != nil {
			return 0, false
		}
	default:
		return 0, false
	}
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, false
	}
	return f, true
}

// isDay reports whether s is a valid YYYY-MM-DD date.
func isDay(s string) bool {
	_, err := time.Parse(time.DateOnly, s)
	return err == nil
}

func looksLikeURL(s string) bool {
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") ||
		strings.HasPrefix(s, "data:") || strings.HasPrefix(s, "/")
}
