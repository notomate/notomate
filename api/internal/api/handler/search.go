package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/search"
)

const (
	maxSearchPageSize = 100
	maxSearchTags     = 20
	maxSearchTerms    = 20
)

type SearchNoteResponse struct {
	GetNoteResponse
	Locations []model.NoteLocation `json:"locations"`
	Events    []model.NoteEvent    `json:"events"`
}

type SearchNotesResponse struct {
	Notes []SearchNoteResponse `json:"notes"`
	// Pending counts the workspace's notes whose index is missing or stale:
	// until it reaches 0, recent changes may not be found yet.
	Pending int64 `json:"pending"`
}

// SearchNotes searches the structured index built by internal/search.
//
//	q        keywords; every one must appear (title, text, tags, places, comments)
//	tags     comma-separated tags; with tagMode=any one is enough, otherwise all
//	bbox     minLng,minLat,maxLng,maxLat: notes with a location inside; a box
//	         with minLng > maxLng crosses the antimeridian
//	eventFrom, eventTo  notes with a calendar block dated within, YYYY-MM-DD,
//	         both inclusive
//	tasks    "open": notes with an unchecked to-do; "done": all checked
//	minRating  notes with a rating block of at least this many stars out of 5
//	creatorId, parentId, pinned, sort, types, dateField, from, to, pageSize,
//	pageNumber as in GetNotes; types are matched against the index
func (h Handler) SearchNotes(c echo.Context) error {
	user := c.Get("user").(model.User)
	f, err := parseSearchFilter(c)
	if err != nil {
		return err
	}
	f.WorkspaceID = c.Param("workspaceId")
	f.UserID = user.ID
	f.ParentID = c.QueryParam("parentId")
	f.PinnedOnly = c.QueryParam("pinned") == "true"

	notes, err := h.db.SearchNotes(f)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	items, err := h.searchNoteResponses(notes)
	if err != nil {
		return err
	}
	pending, err := h.db.CountUnindexedNotes(f.WorkspaceID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, SearchNotesResponse{Notes: items, Pending: pending})
}

// SearchPublicNotes searches every workspace's public root notes, for
// Explore's calendar and map, to anyone signed in or not. It takes the same
// parameters as SearchNotes except parentId and pinned; pending is always 0.
func (h Handler) SearchPublicNotes(c echo.Context) error {
	f, err := parseSearchFilter(c)
	if err != nil {
		return err
	}
	f.ParentID = "null"

	notes, err := h.db.SearchNotes(f)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	items, err := h.searchNoteResponses(notes)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, SearchNotesResponse{Notes: items})
}

// parseSearchFilter reads the query parameters SearchNotes and
// SearchPublicNotes share; the caller sets the scope (workspace, viewer).
func parseSearchFilter(c echo.Context) (model.SearchFilter, error) {
	var list model.NoteFilter
	if err := applyNoteListFilters(c, &list); err != nil {
		return model.SearchFilter{}, err
	}
	f := model.SearchFilter{
		Terms:       search.Terms(c.QueryParam("q")),
		Tags:        parseTags(c.QueryParams()["tags"]),
		MatchAnyTag: c.QueryParam("tagMode") == "any",
		CreatedBy:   list.CreatedBy,
		SortBy:      list.SortBy,
		SortAsc:     list.SortAsc,
		BlockTypes:  list.BlockTypes,
		DateField:   list.DateField,
		DateFrom:    list.DateFrom,
		DateTo:      list.DateTo,
		PageSize:    20,
		PageNumber:  1,
	}
	if len(f.Terms) > maxSearchTerms {
		return f, echo.NewHTTPError(http.StatusBadRequest, "too many search terms")
	}
	if len(f.Tags) > maxSearchTags {
		return f, echo.NewHTTPError(http.StatusBadRequest, "too many tags")
	}
	for param, dst := range map[string]*string{"eventFrom": &f.EventFrom, "eventTo": &f.EventTo} {
		if v := c.QueryParam(param); v != "" {
			if _, err := time.Parse(time.DateOnly, v); err != nil {
				return f, echo.NewHTTPError(http.StatusBadRequest, param+" must be a YYYY-MM-DD date")
			}
			*dst = v
		}
	}
	switch tasks := c.QueryParam("tasks"); tasks {
	case "", "open", "done":
		f.Tasks = tasks
	default:
		return f, echo.NewHTTPError(http.StatusBadRequest, "tasks must be open or done")
	}
	if raw := c.QueryParam("minRating"); raw != "" {
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil || v < 0 || v > 5 {
			return f, echo.NewHTTPError(http.StatusBadRequest, "minRating must be a number from 0 to 5")
		}
		f.MinRating = v
	}
	if raw := c.QueryParam("bbox"); raw != "" {
		bbox, err := parseBBox(raw)
		if err != nil {
			return f, err
		}
		f.BBox = bbox
	}
	if v, err := strconv.Atoi(c.QueryParam("pageSize")); err == nil && v > 0 {
		f.PageSize = min(v, maxSearchPageSize)
	}
	if v, err := strconv.Atoi(c.QueryParam("pageNumber")); err == nil && v > 0 {
		f.PageNumber = v
	}
	return f, nil
}

// searchNoteResponses adds each note's tags, locations and calendar events.
func (h Handler) searchNoteResponses(notes []model.Note) ([]SearchNoteResponse, error) {
	ids := make([]string, len(notes))
	for i, n := range notes {
		ids[i] = n.ID
	}
	tags, err := h.db.FindNoteTags(ids)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	locs, err := h.db.FindNoteLocations(ids)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	events, err := h.db.FindNoteEvents(ids)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	tagsByNote := map[string][]string{}
	for _, t := range tags {
		tagsByNote[t.NoteID] = append(tagsByNote[t.NoteID], t.Tag)
	}
	locsByNote := map[string][]model.NoteLocation{}
	for _, l := range locs {
		locsByNote[l.NoteID] = append(locsByNote[l.NoteID], l)
	}

	eventsByNote := map[string][]model.NoteEvent{}
	for _, e := range events {
		eventsByNote[e.NoteID] = append(eventsByNote[e.NoteID], e)
	}

	res := make([]SearchNoteResponse, 0, len(notes))
	for _, n := range notes {
		createdByName, avatar := h.getUserInfoByID(n.CreatedBy)
		noteTags := tagsByNote[n.ID]
		if noteTags == nil {
			noteTags = []string{}
		}
		noteLocs := locsByNote[n.ID]
		if noteLocs == nil {
			noteLocs = []model.NoteLocation{}
		}
		noteEvents := eventsByNote[n.ID]
		if noteEvents == nil {
			noteEvents = []model.NoteEvent{}
		}
		res = append(res, SearchNoteResponse{
			GetNoteResponse: GetNoteResponse{
				ID:                 n.ID,
				WorkspaceID:        n.WorkspaceID,
				ParentID:           n.ParentID,
				Visibility:         n.Visibility,
				Pinned:             n.Pinned,
				Title:              n.Title,
				Content:            n.Content,
				Tags:               noteTags,
				CreatedAt:          n.CreatedAt,
				CreatedBy:          createdByName,
				CreatedByID:        n.CreatedBy,
				CreatedByAvatarUrl: avatar,
				UpdatedAt:          n.UpdatedAt,
				UpdatedBy:          h.getUserNameByID(n.UpdatedBy),
			},
			Locations: noteLocs,
			Events:    noteEvents,
		})
	}
	return res, nil
}

// GetSearchTags lists the workspace's tags with how many visible notes use
// each, most used first; prefix narrows them for autocomplete.
func (h Handler) GetSearchTags(c echo.Context) error {
	user := c.Get("user").(model.User)
	limit := 50
	if v, err := strconv.Atoi(c.QueryParam("limit")); err == nil && v > 0 {
		limit = min(v, 200)
	}
	tags, err := h.db.FindTags(c.Param("workspaceId"), user.ID, search.NormalizeTag(c.QueryParam("prefix")), limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if tags == nil {
		tags = []model.TagCount{}
	}
	return c.JSON(http.StatusOK, tags)
}

// parseTags accepts tags=a,b as well as repeated tags= parameters.
func parseTags(values []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range values {
		for _, raw := range strings.Split(v, ",") {
			t := search.NormalizeTag(raw)
			if t != "" && !seen[t] {
				seen[t] = true
				out = append(out, t)
			}
		}
	}
	return out
}

func parseBBox(raw string) (*model.BBox, error) {
	parts := strings.Split(raw, ",")
	if len(parts) != 4 {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "bbox must be minLng,minLat,maxLng,maxLat")
	}
	var v [4]float64
	for i, p := range parts {
		f, err := strconv.ParseFloat(strings.TrimSpace(p), 64)
		if err != nil {
			return nil, echo.NewHTTPError(http.StatusBadRequest, "bbox values must be numbers")
		}
		v[i] = f
	}
	b := &model.BBox{MinLng: v[0], MinLat: v[1], MaxLng: v[2], MaxLat: v[3]}
	if b.MinLat < -90 || b.MaxLat > 90 || b.MinLat > b.MaxLat {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "bbox latitudes must be within -90..90 with minLat <= maxLat")
	}
	if b.MinLng < -180 || b.MinLng > 180 || b.MaxLng < -180 || b.MaxLng > 180 {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "bbox longitudes must be within -180..180")
	}
	return b, nil
}
