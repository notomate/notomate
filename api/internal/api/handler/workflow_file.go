package handler

import (
	"errors"
	"net/http"
	"path/filepath"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
)

// Codebase files are shared by every workflow in a workspace, the same way
// workflow vars/secrets are workspace-scoped rather than tied to one
// workflow - so these handlers key off workspaceId only, mirroring
// GetWorkflowVars/GetWorkflowSecrets rather than the per-workflow handlers.

// ListWorkflowFiles returns the workspace's codebase files, without content.
func (h Handler) ListWorkflowFiles(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	files, err := h.db.FindWorkflowFiles(workspaceId)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if files == nil {
		files = []model.WorkflowFile{}
	}

	return c.JSON(http.StatusOK, files)
}

// UploadWorkflowFile adds or replaces a codebase file at a relative path
// within a workspace. The upload is written to storage under a
// server-generated key, never under the caller-supplied path, so path
// validation bugs can't turn into a storage-layer traversal.
func (h Handler) UploadWorkflowFile(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "file is required")
	}

	reqPath := c.FormValue("path")
	if reqPath == "" {
		reqPath = fileHeader.Filename
	}
	cleanPath, err := util.SanitizeRelativePath(reqPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	maxSize := int64(config.C.GetInt64(config.WORKFLOW_FILE_MAX_SIZE_BYTES))
	if fileHeader.Size > maxSize {
		return echo.NewHTTPError(http.StatusBadRequest, "file exceeds the maximum allowed size")
	}

	existing, err := h.db.FindWorkflowFileByPath(workspaceId, cleanPath)
	hasExisting := err == nil
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if !hasExisting {
		existingFiles, err := h.db.FindWorkflowFiles(workspaceId)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		maxCount := config.C.GetInt(config.WORKFLOW_FILE_MAX_COUNT)
		if len(existingFiles) >= maxCount {
			return echo.NewHTTPError(http.StatusBadRequest, "workspace has reached the maximum number of files")
		}
		var totalSize int64
		for _, f := range existingFiles {
			totalSize += f.Size
		}
		maxTotal := int64(config.C.GetInt64(config.WORKFLOW_FILE_MAX_TOTAL_BYTES))
		if totalSize+fileHeader.Size > maxTotal {
			return echo.NewHTTPError(http.StatusBadRequest, "workspace has reached the maximum total codebase size")
		}
	}

	f, err := fileHeader.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to read uploaded file")
	}
	defer f.Close()

	ext := filepath.Ext(fileHeader.Filename)
	storageKey := time.Now().Format("20060102150405") + "_" + randStringRunes(8) + ext
	segments := []string{"workflow-files", workspaceId, storageKey}

	if err := h.storage.Save(segments, f); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save file")
	}

	user := c.Get("user").(model.User)
	now := time.Now().UTC().Format(time.RFC3339)

	if hasExisting {
		// Replace: drop the old blob first, then point the row at the new one.
		oldSegments := []string{"workflow-files", workspaceId, existing.StorageKey}
		if err := h.storage.Delete(oldSegments); err != nil {
			c.Logger().Errorf("failed to delete replaced workflow file blob %s: %v", existing.StorageKey, err)
		}
		if err := h.db.DeleteWorkflowFile(model.WorkflowFileFilter{WorkspaceID: workspaceId, ID: existing.ID}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to replace file record")
		}
	}

	record := model.WorkflowFile{
		ID:          util.NewId(),
		WorkspaceID: workspaceId,
		Path:        cleanPath,
		StorageKey:  storageKey,
		Size:        fileHeader.Size,
		CreatedAt:   now,
		CreatedBy:   user.ID,
		UpdatedAt:   now,
		UpdatedBy:   user.ID,
	}
	if hasExisting {
		record.CreatedAt = existing.CreatedAt
		record.CreatedBy = existing.CreatedBy
	}

	if err := h.db.CreateWorkflowFile(record); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save file record")
	}

	return c.JSON(http.StatusOK, record)
}

// DeleteWorkflowFile removes a codebase file from a workspace.
func (h Handler) DeleteWorkflowFile(c echo.Context) error {
	workspaceId := c.Param("workspaceId")

	id := c.Param("fileId")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "file id is required")
	}

	f, err := h.db.FindWorkflowFileByID(model.WorkflowFileFilter{WorkspaceID: workspaceId, ID: id})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, "file not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if err := h.db.DeleteWorkflowFile(model.WorkflowFileFilter{WorkspaceID: workspaceId, ID: f.ID}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete file record")
	}

	segments := []string{"workflow-files", workspaceId, f.StorageKey}
	if err := h.storage.Delete(segments); err != nil {
		c.Logger().Errorf("failed to delete workflow file blob %s: %v", f.StorageKey, err)
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "file deleted"})
}
