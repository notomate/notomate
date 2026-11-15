package search

import (
	"strings"
	"testing"
)

const fixture = `{"type":"doc","content":[
 {"type":"paragraph","content":[{"type":"text","text":"Hel"},{"type":"text","marks":[{"type":"bold"}],"text":"lo"},{"type":"text","text":" Ｗｏｒｌｄ"}]},
 {"type":"paragraph","content":[{"type":"text","text":"second block"}]},
 {"type":"table","content":[{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"colwidth":null},"content":[{"type":"paragraph","content":[{"type":"text","text":"cell text"}]}]}]}]},
 {"type":"image","attrs":{"src":"/api/v1/workspaces/demo/files/x.png","name":"example.png","uploadId":"up-123"}},
 {"type":"youtubeEmbed","attrs":{"url":"https://www.youtube.com/watch?v=abc"}},
 {"type":"calendarNode","attrs":{"date":"2026-07-15","title":"Team sync","description":"Weekly planning"}},
 {"type":"locationNode","attrs":{"lat":25.033,"lng":121.5654,"name":"Taipei 101","address":"信義區","zoom":15}},
 {"type":"locationNode","attrs":{"lat":null,"lng":null,"name":"Somewhere","address":""}},
 {"type":"tagsNode","attrs":{"tags":["Work","#urgent","work","  旅行 "]}},
 {"type":"googleMapNode","attrs":{"title":"Trip","markers":[{"id":"m1","lat":35.68,"lng":139.76,"name":"Tokyo Station","note":"meet here"}]}},
 {"type":"googlePlacesNode","attrs":{"query":"coffee","places":[{"id":"p1","displayName":{"text":"Cafe A"},"formattedAddress":"Main St","location":{"latitude":1.5,"longitude":2.5}}]}},
 {"type":"googleDirectionsNode","attrs":{"waypoints":[{"id":"w1","lat":10,"lng":20,"name":"Start"}],"result":null}},
 {"type":"subPage","attrs":{"noteId":"n-secret-id","title":"Sub note"}}
]}`

func TestExtract(t *testing.T) {
	idx := Extract("ws", "n1", "My Title", fixture, []string{"Comment BODY"})

	for _, want := range []string{
		"my title", "hello world", "second block", "cell text", "example.png",
		"team sync", "weekly planning", "2026-07-15", "taipei 101", "信義區", "somewhere",
		"urgent", "旅行", "trip", "tokyo station", "meet here", "coffee", "cafe a", "main st",
		"start", "sub note", "comment body",
	} {
		if !strings.Contains(idx.Body, want) {
			t.Errorf("body missing %q:\n%s", want, idx.Body)
		}
	}
	for _, unwanted := range []string{"up-123", "youtube", "/api/v1", "n-secret-id", "bold", "paragraph", "colspan", "hel lo", "second blockcell"} {
		if strings.Contains(idx.Body, unwanted) {
			t.Errorf("body should not contain %q:\n%s", unwanted, idx.Body)
		}
	}

	var tags []string
	for _, tg := range idx.Tags {
		if tg.WorkspaceID != "ws" || tg.NoteID != "n1" {
			t.Errorf("tag ids not set: %+v", tg)
		}
		tags = append(tags, tg.Tag+"="+tg.TagNorm)
	}
	if got := strings.Join(tags, ","); got != "Work=work,urgent=urgent,旅行=旅行" {
		t.Errorf("tags: %s", got)
	}

	if len(idx.Locations) != 4 {
		t.Fatalf("locations: %+v", idx.Locations)
	}
	want := []struct {
		source   string
		name     string
		lat, lng float64
	}{
		{"locationNode", "Taipei 101", 25.033, 121.5654},
		{"googleMapNode", "Tokyo Station", 35.68, 139.76},
		{"googlePlacesNode", "Cafe A", 1.5, 2.5},
		{"googleDirectionsNode", "Start", 10, 20},
	}
	for i, w := range want {
		l := idx.Locations[i]
		if l.Source != w.source || l.Name != w.name || l.Lat != w.lat || l.Lng != w.lng || l.Seq != i || l.NoteID != "n1" {
			t.Errorf("location %d: %+v, want %+v", i, l, w)
		}
	}
}

func TestExtractInvalidJSONFallsBackToText(t *testing.T) {
	idx := Extract("ws", "n1", "", "plain *markdown* text", nil)
	if !strings.Contains(idx.Body, "plain *markdown* text") {
		t.Fatalf("body: %q", idx.Body)
	}
}

func TestExtractRejectsOutOfRangeCoordinates(t *testing.T) {
	idx := Extract("ws", "n1", "", `{"type":"doc","content":[{"type":"locationNode","attrs":{"lat":95,"lng":10,"name":"Bad"}}]}`, nil)
	if len(idx.Locations) != 0 || !strings.Contains(idx.Body, "bad") {
		t.Fatalf("got %+v", idx)
	}
}

func TestNormalize(t *testing.T) {
	if got := Normalize("  Ａｂｃ\n\tDEF  "); got != "abc def" {
		t.Errorf("Normalize: %q", got)
	}
	if got := NormalizeTag(" ##Ｔａｇ "); got != "tag" {
		t.Errorf("NormalizeTag: %q", got)
	}
	if got := Terms("  foo  BAR "); len(got) != 2 || got[0] != "foo" || got[1] != "bar" {
		t.Errorf("Terms: %q", got)
	}
	if Terms("   ") != nil {
		t.Error("blank query should have no terms")
	}
}
