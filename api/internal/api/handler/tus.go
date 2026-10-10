package handler

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/notomate/notomate/internal/model"
	tusd "github.com/tus/tusd/v2/pkg/handler"
	"github.com/tus/tusd/v2/pkg/filestore"
	"github.com/tus/tusd/v2/pkg/memorylocker"
)

// Response headers carrying the stored file once a resumable upload finishes.
const (
	HeaderFileID   = "Notomate-File-Id"
	HeaderFileName = "Notomate-File-Name"
)

type tusUserKey struct{}

// ContextWithUser stores the authenticated user on a request context so the
// tus hooks (which only see the request context) can read it.
func ContextWithUser(ctx context.Context, user model.User) context.Context {
	return context.WithValue(ctx, tusUserKey{}, user)
}

func userFromContext(ctx context.Context) (model.User, bool) {
	user, ok := ctx.Value(tusUserKey{}).(model.User)
	return user, ok && user.ID != ""
}

// ResumableUploads serves the tus protocol for workspace files. Chunks are
// staged on local disk; once complete the file is moved into the configured
// storage (local/S3/MinIO) and recorded like a regular upload.
type ResumableUploads struct {
	h        Handler
	store    filestore.FileStore
	dir      string
	basePath string
	tus      *tusd.Handler
}

func (h Handler) NewResumableUploads(basePath, dir string, maxSize int64) (*ResumableUploads, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	r := &ResumableUploads{h: h, store: filestore.New(dir), dir: dir, basePath: basePath}

	composer := tusd.NewStoreComposer()
	r.store.UseIn(composer)
	memorylocker.New().UseIn(composer)

	handler, err := tusd.NewHandler(tusd.Config{
		BasePath:                  basePath,
		StoreComposer:             composer,
		MaxSize:                   maxSize,
		DisableDownload:           true,
		PreUploadCreateCallback:   r.preCreate,
		PreFinishResponseCallback: r.preFinish,
	})
	if err != nil {
		return nil, err
	}
	r.tus = handler
	return r, nil
}

// Handler returns the http.Handler to mount at basePath.
func (r *ResumableUploads) Handler() http.Handler {
	inner := http.StripPrefix(r.basePath, r.tus)
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		inner.ServeHTTP(&relativeLocationWriter{ResponseWriter: w}, req)
	})
}

// Authorize ensures the upload being resumed/terminated belongs to user.
// Upload creation (POST to the base path) is checked in preCreate instead.
func (r *ResumableUploads) Authorize(ctx context.Context, uploadID string, user model.User) error {
	upload, err := r.store.GetUpload(ctx, uploadID)
	if err != nil {
		// Let tusd answer with its own 404 for unknown uploads.
		return nil
	}
	info, err := upload.GetInfo(ctx)
	if err != nil {
		return nil
	}
	if info.MetaData["userId"] != user.ID {
		return errors.New("upload belongs to another user")
	}
	return nil
}

func (r *ResumableUploads) preCreate(hook tusd.HookEvent) (tusd.HTTPResponse, tusd.FileInfoChanges, error) {
	user, ok := userFromContext(hook.Context)
	if !ok {
		return tusd.HTTPResponse{}, tusd.FileInfoChanges{}, tusd.NewError("ERR_UNAUTHORIZED", "authentication required", http.StatusUnauthorized)
	}
	meta := hook.Upload.MetaData
	workspaceId := meta["workspaceId"]
	filename := strings.TrimSpace(meta["filename"])
	if workspaceId == "" || filename == "" {
		return tusd.HTTPResponse{}, tusd.FileInfoChanges{}, tusd.NewError("ERR_BAD_METADATA", "workspaceId and filename metadata are required", http.StatusBadRequest)
	}
	members, err := r.h.db.FindWorkspaceUsers(model.WorkspaceUserFilter{WorkspaceID: workspaceId, UserID: user.ID})
	if err != nil || len(members) == 0 {
		return tusd.HTTPResponse{}, tusd.FileInfoChanges{}, tusd.NewError("ERR_FORBIDDEN", "restricted to workspace members only", http.StatusForbidden)
	}
	return tusd.HTTPResponse{}, tusd.FileInfoChanges{MetaData: tusd.MetaData{
		"workspaceId": workspaceId,
		"filename":    filepath.Base(filename),
		"filetype":    meta["filetype"],
		"userId":      user.ID,
	}}, nil
}

func (r *ResumableUploads) preFinish(hook tusd.HookEvent) (tusd.HTTPResponse, error) {
	user, ok := userFromContext(hook.Context)
	if !ok || hook.Upload.MetaData["userId"] != user.ID {
		return tusd.HTTPResponse{}, tusd.NewError("ERR_FORBIDDEN", "upload belongs to another user", http.StatusForbidden)
	}
	// The hook context is cancelled shortly after the request ends; moving a
	// large file into S3 must not be cut off by that.
	ctx := context.WithoutCancel(hook.Context)

	upload, err := r.store.GetUpload(ctx, hook.Upload.ID)
	if err != nil {
		return tusd.HTTPResponse{}, err
	}
	reader, err := upload.GetReader(ctx)
	if err != nil {
		return tusd.HTTPResponse{}, err
	}
	meta := hook.Upload.MetaData
	file, err := r.h.persistWorkspaceFile(meta["workspaceId"], user, meta["filename"], hook.Upload.Size, reader)
	reader.Close()
	if err != nil {
		return tusd.HTTPResponse{}, err
	}

	if err := r.store.AsTerminatableUpload(upload).Terminate(ctx); err != nil {
		log.Printf("tus: failed to remove staged upload %s: %v", hook.Upload.ID, err)
	}

	return tusd.HTTPResponse{Header: tusd.HTTPHeader{
		HeaderFileID:   file.ID,
		HeaderFileName: file.Name,
	}}, nil
}

// StartJanitor periodically removes staged uploads that were abandoned.
func (r *ResumableUploads) StartJanitor(ctx context.Context, interval, maxAge time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			r.cleanupExpired(maxAge)
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func (r *ResumableUploads) cleanupExpired(maxAge time.Duration) {
	entries, err := os.ReadDir(r.dir)
	if err != nil {
		return
	}
	cutoff := time.Now().Add(-maxAge)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".info") {
			continue
		}
		info, err := e.Info()
		if err != nil || info.ModTime().After(cutoff) {
			continue
		}
		// The .info file is rewritten on every chunk, but check the data
		// file too in case it was touched more recently.
		id := strings.TrimSuffix(e.Name(), ".info")
		bin := filepath.Join(r.dir, id)
		if st, err := os.Stat(bin); err == nil && st.ModTime().After(cutoff) {
			continue
		}
		os.Remove(bin)
		os.Remove(filepath.Join(r.dir, e.Name()))
	}
}

// relativeLocationWriter strips scheme and host from the Location header so
// the client resolves upload URLs against whatever origin it used, which
// keeps them correct behind nginx and the Vite dev proxy.
type relativeLocationWriter struct {
	http.ResponseWriter
}

func (w *relativeLocationWriter) WriteHeader(status int) {
	if loc := w.Header().Get("Location"); loc != "" {
		if u, err := url.Parse(loc); err == nil && u.IsAbs() {
			w.Header().Set("Location", u.RequestURI())
		}
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *relativeLocationWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}
