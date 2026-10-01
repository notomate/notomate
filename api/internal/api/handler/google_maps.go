package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/notomate/notomate/internal/googlemaps"
	"github.com/notomate/notomate/internal/model"
)

type GoogleMapsIntegrationResponse struct {
	Configured    bool   `json:"configured"`
	HasBrowserKey bool   `json:"has_browser_key"`
	MapID         string `json:"map_id"`
}

type UpdateGoogleMapsIntegrationRequest struct {
	// Empty keys keep the stored value, so the UI never needs to read keys
	// back to save other fields.
	ServerKey       string `json:"server_key"`
	BrowserKey      string `json:"browser_key"`
	ClearBrowserKey bool   `json:"clear_browser_key"`
	MapID           string `json:"map_id"`
}

type GoogleMapsBrowserKeyResponse struct {
	Key   string `json:"key"`
	MapID string `json:"map_id"`
}

func (h Handler) GetGoogleMapsIntegration(c echo.Context) error {
	cfg, err := h.googleMaps.GetConfig(c.Param("workspaceId"))
	if errors.Is(err, googlemaps.ErrNotConfigured) {
		return c.JSON(http.StatusOK, GoogleMapsIntegrationResponse{})
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, GoogleMapsIntegrationResponse{
		Configured:    true,
		HasBrowserKey: cfg.BrowserKey != "",
		MapID:         cfg.MapID,
	})
}

func (h Handler) UpdateGoogleMapsIntegration(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	var req UpdateGoogleMapsIntegrationRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	cfg, err := h.googleMaps.GetConfig(workspaceId)
	if err != nil && !errors.Is(err, googlemaps.ErrNotConfigured) {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if key := strings.TrimSpace(req.ServerKey); key != "" {
		cfg.ServerKey = key
	}
	if cfg.ServerKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "server_key is required")
	}
	if req.ClearBrowserKey {
		cfg.BrowserKey = ""
	} else if key := strings.TrimSpace(req.BrowserKey); key != "" {
		cfg.BrowserKey = key
	}
	cfg.MapID = strings.TrimSpace(req.MapID)

	user := c.Get("user").(model.User)
	if err := h.googleMaps.SaveConfig(workspaceId, user.ID, cfg); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, GoogleMapsIntegrationResponse{
		Configured:    true,
		HasBrowserKey: cfg.BrowserKey != "",
		MapID:         cfg.MapID,
	})
}

func (h Handler) DeleteGoogleMapsIntegration(c echo.Context) error {
	if err := h.googleMaps.DeleteConfig(c.Param("workspaceId")); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// GetGoogleMapsBrowserKey returns the key the Maps JavaScript API needs in
// the browser. Workspace admins should restrict it by HTTP referrer.
func (h Handler) GetGoogleMapsBrowserKey(c echo.Context) error {
	cfg, err := h.googleMaps.GetConfig(c.Param("workspaceId"))
	if err != nil {
		return googleMapsError(err)
	}
	return c.JSON(http.StatusOK, GoogleMapsBrowserKeyResponse{
		Key:   cfg.BrowserKeyOrFallback(),
		MapID: cfg.MapID,
	})
}

func (h Handler) SearchGooglePlaces(c echo.Context) error {
	var req googlemaps.SearchRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	req.Query = strings.TrimSpace(req.Query)
	if req.Query == "" || len(req.Query) > 300 {
		return echo.NewHTTPError(http.StatusBadRequest, "query must be 1-300 characters")
	}

	res, err := h.googleMaps.SearchText(c.Request().Context(), c.Param("workspaceId"), req)
	if err != nil {
		return googleMapsError(err)
	}
	return c.JSONBlob(http.StatusOK, res)
}

func (h Handler) GetGooglePlace(c echo.Context) error {
	res, err := h.googleMaps.PlaceDetails(c.Request().Context(), c.Param("workspaceId"), c.Param("placeId"), c.QueryParam("lang"))
	if err != nil {
		return googleMapsError(err)
	}
	return c.JSONBlob(http.StatusOK, res)
}

func (h Handler) ComputeGoogleRoutes(c echo.Context) error {
	var req googlemaps.RouteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	res, err := h.googleMaps.ComputeRoutes(c.Request().Context(), c.Param("workspaceId"), req)
	if err != nil {
		return googleMapsError(err)
	}
	return c.JSONBlob(http.StatusOK, res)
}

// GetGooglePlacePhoto is reachable without auth so shared notes can show
// photos. Anonymous requests can only fetch photos of places this workspace
// has already looked up; members can fetch any place photo.
func (h Handler) GetGooglePlacePhoto(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	width, _ := strconv.Atoi(c.QueryParam("w"))

	allowFetch := func(placeID string) (bool, error) {
		if h.isWorkspaceMember(c, workspaceId) {
			return true, nil
		}
		return h.googleMaps.HasPlace(workspaceId, placeID)
	}

	f, contentType, err := h.googleMaps.Photo(c.Request().Context(), workspaceId, c.QueryParam("name"), width, allowFetch)
	if err != nil {
		return googleMapsError(err)
	}
	defer f.Close()

	c.Response().Header().Set("Cache-Control", "private, max-age=86400")
	return c.Stream(http.StatusOK, contentType, io.Reader(f))
}

func (h Handler) isWorkspaceMember(c echo.Context, workspaceId string) bool {
	user, ok := c.Get("user").(model.User)
	if !ok || user.ID == "" {
		return false
	}
	members, err := h.db.FindWorkspaceUsers(model.WorkspaceUserFilter{WorkspaceID: workspaceId, UserID: user.ID})
	return err == nil && len(members) > 0
}

func googleMapsError(err error) error {
	var apiErr *googlemaps.APIError
	switch {
	case errors.Is(err, googlemaps.ErrNotConfigured):
		return echo.NewHTTPError(http.StatusPreconditionFailed, "google_maps_not_configured")
	case errors.Is(err, googlemaps.ErrInvalidPhoto):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, googlemaps.ErrPhotoNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case errors.As(err, &apiErr):
		switch apiErr.StatusCode {
		case http.StatusBadRequest, http.StatusNotFound, http.StatusTooManyRequests:
			return echo.NewHTTPError(apiErr.StatusCode, apiErr.Error())
		default:
			// 401/403 from Google mean the workspace key is wrong or lacks an
			// enabled API; don't pass them through as our own auth errors.
			return echo.NewHTTPError(http.StatusBadGateway, apiErr.Error())
		}
	default:
		return echo.NewHTTPError(http.StatusBadGateway, err.Error())
	}
}
