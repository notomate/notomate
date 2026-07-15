package handler

import (
	"math/rand"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
)

func (h Handler) Upload(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Workspace id is required")
	}
	file, err := c.FormFile("file")
	if err != nil {
		return c.String(http.StatusBadRequest, "")
	}

	f, err := file.Open()
	if err != nil {
		return c.String(http.StatusInternalServerError, "")
	}
	defer f.Close()

	segments := []string{workspaceId}

	ext := filepath.Ext(file.Filename)
	randomStr := randStringRunes(4)
	newFileName := time.Now().Format("20060102150405") + "_" + randomStr + ext

	segments = append(segments, newFileName)

	err = h.storage.Save(segments, f)
	if err != nil {
		return c.String(http.StatusInternalServerError, "")
	}
	user := c.Get("user").(model.User)

	now := time.Now().Format(time.RFC3339)
	fileModel := model.File{
		WorkspaceID:      workspaceId,
		ID:               util.NewId(),
		Name:             newFileName,
		Ext:              ext,
		Size:             file.Size,
		OriginalFilename: file.Filename,
		CreatedAt:        now,
		CreatedBy:        user.ID,
		UpdatedAt:        now,
		UpdatedBy:        user.ID,
	}
	if err := h.db.CreateFile(fileModel); err != nil {
		return c.String(http.StatusInternalServerError, "failed to save file record")
	}

	return c.JSON(http.StatusOK, echo.Map{
		"id":            fileModel.ID,
		"filename":      newFileName,
		"original_name": file.Filename,
		"size":          file.Size,
		"ext":           ext,
		"created_at":    fileModel.CreatedAt,
		"updated_at":    fileModel.UpdatedAt,
	})
}

func (h Handler) Download(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	filename := c.Param("id")
	if workspaceId == "" || filename == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Workspace id and filename are required")
	}

	segments := []string{workspaceId, filename}

	f, err := h.storage.Load(segments)

	if err != nil {
		return err
	}
	defer f.Close()

	http.ServeContent(c.Response(), c.Request(), filename, time.Time{}, f)
	return nil
}

func (h Handler) Delete(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	id := c.Param("id")
	if workspaceId == "" || id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Workspace id and filename are required")
	}
	filter := model.FileFilter{
		WorkspaceID: workspaceId,
		ID:          id,
	}

	f, err := h.db.FindFileByID(id)

	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Failed to find file")
	}

	if err := h.db.DeleteFile(filter); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete file record")
	}

	segments := []string{workspaceId, f.Name}

	err = h.storage.Delete(segments)

	if err != nil {
		return c.JSON(http.StatusBadRequest, "failed to delete file")
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "File deleted"})
}

func (h Handler) List(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	if workspaceId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Workspace id is required")
	}

	// Get pagination parameters
	pageSize := 20
	pageNumber := 1
	if ps := c.QueryParam("pageSize"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 {
			pageSize = v
		}
	}
	if pn := c.QueryParam("pageNumber"); pn != "" {
		if v, err := strconv.Atoi(pn); err == nil && v > 0 {
			pageNumber = v
		}
	}

	// Get query parameters
	query := c.QueryParam("q")
	extFilter := c.QueryParam("ext")

	filter := model.FileFilter{
		WorkspaceID: workspaceId,
		Query:       query,
		PageSize:    pageSize,
		PageNumber:  pageNumber,
	}

	// Parse extension filter (split comma-separated extensions)
	if extFilter != "" {
		exts := make([]string, 0)
		for _, ext := range splitAndTrim(extFilter, ",") {
			if ext != "" {
				exts = append(exts, ext)
			}
		}
		if len(exts) > 0 {
			filter.Exts = exts
		}
	}

	files, err := h.db.FindFiles(filter)
	if err != nil {
		c.Logger().Errorf("Failed to list files for workspace %s: %v", workspaceId, err)
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to list files: "+err.Error())
	}
	fileInfos := make([]map[string]interface{}, 0, len(files))
	for _, f := range files {
		fileInfos = append(fileInfos, map[string]interface{}{
			"id":            f.ID,
			"name":          f.Name,
			"original_name": f.OriginalFilename,
			"size":          f.Size,
			"ext":           f.Ext,
			"created_at":    f.CreatedAt,
			"updated_at":    f.UpdatedAt,
		})
	}
	return c.JSON(http.StatusOK, echo.Map{"files": fileInfos})
}

func (h Handler) RenameFile(c echo.Context) error {
	workspaceId := c.Param("workspaceId")
	id := c.Param("id")
	if workspaceId == "" || id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Workspace id and file id are required")
	}

	var req struct {
		OriginalFilename string `json:"original_filename"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if req.OriginalFilename == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Original filename is required")
	}

	file, err := h.db.FindFileByID(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "File not found")
	}

	if file.WorkspaceID != workspaceId {
		return echo.NewHTTPError(http.StatusForbidden, "File does not belong to this workspace")
	}

	user := c.Get("user").(model.User)
	file.OriginalFilename = req.OriginalFilename
	file.UpdatedAt = time.Now().Format(time.RFC3339)
	file.UpdatedBy = user.ID

	if err := h.db.UpdateFile(file); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to rename file")
	}

	return c.JSON(http.StatusOK, echo.Map{
		"id":            file.ID,
		"name":          file.Name,
		"original_name": file.OriginalFilename,
		"size":          file.Size,
		"ext":           file.Ext,
	})
}

var letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

func randStringRunes(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}

func splitAndTrim(s string, sep string) []string {
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
