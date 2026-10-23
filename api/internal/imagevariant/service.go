// Package imagevariant serves downscaled copies of uploaded images. Variants
// are generated on first request and cached in storage next to the
// originals, so thumbnails need no background worker.
package imagevariant

import (
	"bufio"
	"bytes"
	"context"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage"
	"golang.org/x/image/draw"
	"golang.org/x/sync/singleflight"
)

const (
	storageRoot = "_thumbs"
	// Larger images are served as-is rather than decoded in memory.
	maxPixels   = 32_000_000
	jpegQuality = 80
	// Concurrent decodes; each can hold a full-size image in memory.
	maxConcurrent = 2
	backfillBatch = 100
)

// Widths are the variant sizes. Requested widths snap up to one of them so
// requests share cache entries. The larger sizes serve the full-screen
// image viewer on high-density and desktop screens.
var Widths = []int{320, 640, 1280, 1920, 2560}

// FileStore is the part of the database the dimension backfill needs.
type FileStore interface {
	FindFilesMissingDimensions(afterID string, exts []string, limit int) ([]model.File, error)
	UpdateFileDimensions(id string, width, height int) error
}

type Service struct {
	storage storage.Storage
	files   FileStore
	group   singleflight.Group
	sem     chan struct{}
}

func NewService(s storage.Storage, files FileStore) *Service {
	return &Service{storage: s, files: files, sem: make(chan struct{}, maxConcurrent)}
}

// IsResizable reports whether variants can be generated for this extension.
// GIFs (possibly animated) and SVGs are always served as uploaded.
func IsResizable(ext string) bool {
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg", ".png", ".webp":
		return true
	}
	return false
}

// SnapWidth rounds width up to the nearest variant size.
func SnapWidth(width int) int {
	for _, w := range Widths {
		if width <= w {
			return w
		}
	}
	return Widths[len(Widths)-1]
}

// Variant opens the workspace file name scaled down to at most width pixels
// wide. It also returns a file name whose extension matches the content, for
// content type detection. Files that can't or needn't be scaled (not an
// image, already small enough, too large to decode) are returned unchanged.
func (s *Service) Variant(workspaceID, name string, width int) (io.ReadSeekCloser, string, error) {
	ext := strings.ToLower(filepath.Ext(name))
	if !IsResizable(ext) {
		return s.original(workspaceID, name)
	}
	width = SnapWidth(width)
	for _, out := range outputExts(ext) {
		vname := variantName(name, width, out)
		if f, err := s.storage.Load(segments(workspaceID, vname)); err == nil {
			return f, vname, nil
		}
	}

	v, err, _ := s.group.Do(workspaceID+"/"+name+"/"+strconv.Itoa(width), func() (any, error) {
		s.sem <- struct{}{}
		defer func() { <-s.sem }()
		return s.generate(workspaceID, name, ext, width)
	})
	if err != nil {
		log.Printf("imagevariant: generate %s/%s at %d: %v", workspaceID, name, width, err)
		return s.original(workspaceID, name)
	}
	r, _ := v.(*result)
	if r == nil {
		return s.original(workspaceID, name)
	}
	return nopCloser{bytes.NewReader(r.data)}, r.name, nil
}

// DeleteVariants removes every cached variant of a file.
func (s *Service) DeleteVariants(workspaceID, name string) {
	ext := strings.ToLower(filepath.Ext(name))
	if !IsResizable(ext) {
		return
	}
	for _, w := range Widths {
		for _, out := range outputExts(ext) {
			// Most of these never existed; not-found errors are expected.
			_ = s.storage.Delete(segments(workspaceID, variantName(name, w, out)))
		}
	}
}

type result struct {
	data []byte
	name string
}

// generate returns nil when the original should be served instead.
func (s *Service) generate(workspaceID, name, ext string, width int) (*result, error) {
	src, err := s.storage.Load([]string{workspaceID, name})
	if err != nil {
		return nil, err
	}
	defer src.Close()

	br := bufio.NewReaderSize(src, ProbeBytes)
	// A short read just means the whole file fits in the buffer.
	header, _ := br.Peek(ProbeBytes)
	w, h, ok := ProbeDimensions(header)
	if !ok || w <= width || w*h > maxPixels {
		return nil, nil
	}
	orientation := jpegOrientation(header)

	img, _, err := image.Decode(br)
	if err != nil {
		return nil, err
	}
	// Resize before rotating so only the small image is transformed;
	// width is the displayed width, which is the stored height when the
	// orientation rotates by 90°.
	var scaled *image.NRGBA
	if swapsAxes(orientation) {
		scaled = resizeToHeight(img, width)
	} else {
		scaled = resizeToWidth(img, width)
	}
	img = applyOrientation(scaled, orientation)

	out := ".jpg"
	if ext != ".jpg" && ext != ".jpeg" && !isOpaque(img) {
		out = ".png"
	}
	var buf bytes.Buffer
	if out == ".png" {
		err = png.Encode(&buf, img)
	} else {
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: jpegQuality})
	}
	if err != nil {
		return nil, err
	}
	vname := variantName(name, width, out)
	if err := s.storage.Save(segments(workspaceID, vname), bytes.NewReader(buf.Bytes())); err != nil {
		// Still serve the variant; it is regenerated on the next request.
		log.Printf("imagevariant: cache %s/%s: %v", workspaceID, vname, err)
	}
	return &result{data: buf.Bytes(), name: vname}, nil
}

func (s *Service) original(workspaceID, name string) (io.ReadSeekCloser, string, error) {
	f, err := s.storage.Load([]string{workspaceID, name})
	return f, name, err
}

// StartBackfill records dimensions for images uploaded before they were
// tracked. It runs once in the background and stops when ctx is cancelled.
func (s *Service) StartBackfill(ctx context.Context) {
	go func() {
		n, err := s.Backfill(ctx)
		if err != nil {
			log.Printf("imagevariant: backfill dimensions: %v", err)
		}
		if n > 0 {
			log.Printf("imagevariant: backfilled dimensions for %d files", n)
		}
	}()
}

// Backfill probes every image file without dimensions and returns how many
// were processed. Unreadable files are recorded as 0x0 so they are skipped
// next time.
func (s *Service) Backfill(ctx context.Context) (int, error) {
	count := 0
	afterID := ""
	for {
		files, err := s.files.FindFilesMissingDimensions(afterID, ProbeExts, backfillBatch)
		if err != nil {
			return count, err
		}
		for _, f := range files {
			if err := ctx.Err(); err != nil {
				return count, err
			}
			w, h := s.probeStored(f)
			if err := s.files.UpdateFileDimensions(f.ID, w, h); err != nil {
				return count, err
			}
			count++
		}
		if len(files) < backfillBatch {
			return count, nil
		}
		afterID = files[len(files)-1].ID
	}
}

func (s *Service) probeStored(f model.File) (int, int) {
	r, err := s.storage.Load([]string{f.WorkspaceID, f.Name})
	if err != nil {
		return 0, 0
	}
	defer r.Close()
	w, h, ok := Probe(r)
	if !ok {
		return 0, 0
	}
	return w, h
}

func segments(workspaceID, vname string) []string {
	return []string{storageRoot, workspaceID, vname}
}

func variantName(name string, width int, ext string) string {
	return strings.TrimSuffix(name, filepath.Ext(name)) + "_w" + strconv.Itoa(width) + ext
}

// outputExts lists the formats a variant of ext may have been encoded in:
// JPEG sources stay JPEG; PNG/WebP become JPEG unless they have
// transparency.
func outputExts(ext string) []string {
	if ext == ".jpg" || ext == ".jpeg" {
		return []string{".jpg"}
	}
	return []string{".jpg", ".png"}
}

func isOpaque(img image.Image) bool {
	if o, ok := img.(interface{ Opaque() bool }); ok {
		return o.Opaque()
	}
	return false
}

// resizeToWidth scales img to width pixels wide, keeping its aspect ratio.
func resizeToWidth(img image.Image, width int) *image.NRGBA {
	b := img.Bounds()
	return scale(img, width, max(1, int(float64(width)*float64(b.Dy())/float64(b.Dx())+0.5)))
}

// resizeToHeight scales img to height pixels tall, keeping its aspect ratio.
func resizeToHeight(img image.Image, height int) *image.NRGBA {
	b := img.Bounds()
	return scale(img, max(1, int(float64(height)*float64(b.Dx())/float64(b.Dy())+0.5)), height)
}

func scale(img image.Image, width, height int) *image.NRGBA {
	dst := image.NewNRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Src, nil)
	return dst
}

// applyOrientation turns stored pixels into the displayed orientation.
func applyOrientation(img *image.NRGBA, orientation int) *image.NRGBA {
	w, h := img.Bounds().Dx(), img.Bounds().Dy()
	// src maps a destination pixel to the source pixel it is copied from.
	var src func(x, y int) (int, int)
	dw, dh := w, h
	switch orientation {
	case 2: // mirrored horizontally
		src = func(x, y int) (int, int) { return w - 1 - x, y }
	case 3: // rotated 180°
		src = func(x, y int) (int, int) { return w - 1 - x, h - 1 - y }
	case 4: // mirrored vertically
		src = func(x, y int) (int, int) { return x, h - 1 - y }
	case 5: // transposed
		src = func(x, y int) (int, int) { return y, x }
	case 6: // rotated 90° clockwise
		src = func(x, y int) (int, int) { return y, h - 1 - x }
	case 7: // transversed
		src = func(x, y int) (int, int) { return w - 1 - y, h - 1 - x }
	case 8: // rotated 90° counter-clockwise
		src = func(x, y int) (int, int) { return w - 1 - y, x }
	default:
		return img
	}
	if swapsAxes(orientation) {
		dw, dh = h, w
	}
	dst := image.NewNRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < dh; y++ {
		for x := 0; x < dw; x++ {
			sx, sy := src(x, y)
			si := img.PixOffset(img.Rect.Min.X+sx, img.Rect.Min.Y+sy)
			copy(dst.Pix[dst.PixOffset(x, y):dst.PixOffset(x, y)+4], img.Pix[si:si+4])
		}
	}
	return dst
}

type nopCloser struct{ *bytes.Reader }

func (nopCloser) Close() error { return nil }
