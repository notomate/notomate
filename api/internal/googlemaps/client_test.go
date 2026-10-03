package googlemaps

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestClient(srv *httptest.Server) *Client {
	return &Client{PlacesBaseURL: srv.URL + "/v1", RoutesBaseURL: srv.URL, HTTP: srv.Client()}
}

func TestSearchTextSendsKeyFieldMaskAndBias(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/places:searchText" {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("X-Goog-Api-Key"); got != "k1" {
			t.Errorf("api key header = %q", got)
		}
		if !strings.Contains(r.Header.Get("X-Goog-FieldMask"), "places.id") {
			t.Errorf("field mask = %q", r.Header.Get("X-Goog-FieldMask"))
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["textQuery"] != "taipei 101" || body["languageCode"] != "zh-TW" {
			t.Errorf("body = %v", body)
		}
		if _, ok := body["locationBias"]; !ok {
			t.Errorf("locationBias missing: %v", body)
		}
		w.Write([]byte(`{"places":[]}`))
	}))
	defer srv.Close()

	_, err := newTestClient(srv).SearchText(context.Background(), "k1", SearchRequest{
		Query: "taipei 101", LanguageCode: "zh-TW", Bias: &LatLng{Lat: 25.03, Lng: 121.56},
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestComputeRoutesBuildsWaypoints(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/directions/v2:computeRoutes" {
			t.Errorf("path = %s", r.URL.Path)
		}
		var body struct {
			Origin        map[string]any   `json:"origin"`
			Destination   map[string]any   `json:"destination"`
			Intermediates []map[string]any `json:"intermediates"`
			TravelMode    string           `json:"travelMode"`
			Optimize      bool             `json:"optimizeWaypointOrder"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Origin["placeId"] != "A" {
			t.Errorf("origin = %v", body.Origin)
		}
		if _, ok := body.Destination["location"]; !ok {
			t.Errorf("destination = %v", body.Destination)
		}
		if len(body.Intermediates) != 2 || !body.Optimize || body.TravelMode != "DRIVE" {
			t.Errorf("body = %+v", body)
		}
		w.Write([]byte(`{"routes":[]}`))
	}))
	defer srv.Close()

	_, err := newTestClient(srv).ComputeRoutes(context.Background(), "k", RouteRequest{
		Waypoints:  []Waypoint{{PlaceID: "A"}, {PlaceID: "B"}, {PlaceID: "C"}, {Lat: 25, Lng: 121}},
		TravelMode: "DRIVE",
		Optimize:   true,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestComputeRoutesAsksForAlternativesOnlyForTransit(t *testing.T) {
	for mode, want := range map[string]bool{"TRANSIT": true, "DRIVE": false} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				ComputeAlternativeRoutes bool `json:"computeAlternativeRoutes"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body.ComputeAlternativeRoutes != want {
				t.Errorf("%s: computeAlternativeRoutes = %v, want %v", mode, body.ComputeAlternativeRoutes, want)
			}
			if !strings.Contains(r.Header.Get("X-Goog-FieldMask"), "transitDetails") {
				t.Errorf("%s: field mask = %q", mode, r.Header.Get("X-Goog-FieldMask"))
			}
			w.Write([]byte(`{"routes":[]}`))
		}))
		_, err := newTestClient(srv).ComputeRoutes(context.Background(), "k", RouteRequest{
			Waypoints:  []Waypoint{{PlaceID: "A"}, {PlaceID: "B"}},
			TravelMode: mode,
		})
		srv.Close()
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestRouteRequestValidate(t *testing.T) {
	many := make([]Waypoint, MaxIntermediates+3)
	for i := range many {
		many[i] = Waypoint{PlaceID: "p"}
	}
	cases := []struct {
		name    string
		req     RouteRequest
		wantErr bool
	}{
		{"ok", RouteRequest{Waypoints: []Waypoint{{PlaceID: "a"}, {PlaceID: "b"}}, TravelMode: "WALK"}, false},
		{"one waypoint", RouteRequest{Waypoints: []Waypoint{{PlaceID: "a"}}, TravelMode: "WALK"}, true},
		{"bad mode", RouteRequest{Waypoints: []Waypoint{{PlaceID: "a"}, {PlaceID: "b"}}, TravelMode: "FLY"}, true},
		{"transit intermediates", RouteRequest{Waypoints: []Waypoint{{PlaceID: "a"}, {PlaceID: "b"}, {PlaceID: "c"}}, TravelMode: "TRANSIT"}, true},
		{"too many", RouteRequest{Waypoints: many, TravelMode: "DRIVE"}, true},
		{"empty waypoint", RouteRequest{Waypoints: []Waypoint{{PlaceID: "a"}, {}}, TravelMode: "DRIVE"}, true},
	}
	for _, tc := range cases {
		if err := tc.req.Validate(); (err != nil) != tc.wantErr {
			t.Errorf("%s: err = %v, wantErr %v", tc.name, err, tc.wantErr)
		}
	}
}

func TestPhotoMediaDoesNotForwardKeyToImageHost(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/places/P1/photos/X/media":
			if r.URL.Query().Get("skipHttpRedirect") != "true" || r.Header.Get("X-Goog-Api-Key") != "k" {
				t.Errorf("media request = %s key=%q", r.URL.RawQuery, r.Header.Get("X-Goog-Api-Key"))
			}
			w.Write([]byte(`{"photoUri":"` + srv.URL + `/img"}`))
		case "/img":
			if r.Header.Get("X-Goog-Api-Key") != "" {
				t.Error("api key forwarded to image host")
			}
			w.Header().Set("Content-Type", "image/jpeg")
			w.Write([]byte("jpeg-bytes"))
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
		}
	}))
	defer srv.Close()

	data, ct, err := newTestClient(srv).PhotoMedia(context.Background(), "k", "places/P1/photos/X", 400)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "jpeg-bytes" || ct != "image/jpeg" {
		t.Errorf("got %q %q", data, ct)
	}
}

func TestAPIErrorIsParsed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"error":{"code":403,"message":"API not enabled","status":"PERMISSION_DENIED"}}`))
	}))
	defer srv.Close()

	_, err := newTestClient(srv).PlaceDetails(context.Background(), "k", "P1", "")
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode != 403 || apiErr.Message != "API not enabled" {
		t.Fatalf("err = %v", err)
	}
}
