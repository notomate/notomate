package imagevariant

import (
	"bytes"
	"context"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/storage"
	"github.com/notomate/notomate/internal/storage/localfile"
)

func newStorage(t *testing.T) (storage.Storage, string) {
	t.Helper()
	dir := t.TempDir()
	return localfile.NewLocalFileStorage(filepath.ToSlash(dir) + "/"), dir
}

func solid(w, h int, c color.Color) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	return img
}

func encodeJPEG(t *testing.T, img image.Image, orientation int) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatal(err)
	}
	b := buf.Bytes()
	if orientation == 0 {
		return b
	}
	// Splice an EXIF APP1 segment with an orientation tag in after SOI.
	tiff := []byte("II*\x00\x08\x00\x00\x00\x01\x00")
	entry := make([]byte, 12)
	binary.LittleEndian.PutUint16(entry[0:], 0x0112)
	binary.LittleEndian.PutUint16(entry[2:], 3)
	binary.LittleEndian.PutUint32(entry[4:], 1)
	binary.LittleEndian.PutUint16(entry[8:], uint16(orientation))
	tiff = append(tiff, entry...)
	tiff = append(tiff, 0, 0, 0, 0)
	payload := append([]byte("Exif\x00\x00"), tiff...)
	seg := []byte{0xFF, 0xE1, 0, 0}
	binary.BigEndian.PutUint16(seg[2:], uint16(len(payload)+2))
	seg = append(seg, payload...)
	out := append([]byte{}, b[:2]...)
	out = append(out, seg...)
	return append(out, b[2:]...)
}

func encodePNG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func save(t *testing.T, s storage.Storage, name string, data []byte) {
	t.Helper()
	if err := s.Save([]string{"ws", name}, bytes.NewReader(data)); err != nil {
		t.Fatal(err)
	}
}

func decode(t *testing.T, r io.Reader) image.Image {
	t.Helper()
	img, _, err := image.Decode(r)
	if err != nil {
		t.Fatal(err)
	}
	return img
}

func TestProbeDimensionsAppliesOrientation(t *testing.T) {
	img := solid(40, 20, color.White)
	for orientation, want := range map[int][2]int{0: {40, 20}, 1: {40, 20}, 3: {40, 20}, 6: {20, 40}, 8: {20, 40}} {
		w, h, ok := ProbeDimensions(encodeJPEG(t, img, orientation))
		if !ok || w != want[0] || h != want[1] {
			t.Errorf("orientation %d: got %dx%d ok=%v, want %dx%d", orientation, w, h, ok, want[0], want[1])
		}
	}
	if _, _, ok := ProbeDimensions([]byte("not an image")); ok {
		t.Error("expected garbage to fail probing")
	}
}

func TestVariantScalesAndCaches(t *testing.T) {
	s, dir := newStorage(t)
	save(t, s, "big.jpg", encodeJPEG(t, solid(2000, 1000, color.White), 0))
	svc := NewService(s, nil)

	f, name, err := svc.Variant("ws", "big.jpg", 300)
	if err != nil {
		t.Fatal(err)
	}
	if name != "big_w320.jpg" {
		t.Fatalf("expected snapped variant name, got %q", name)
	}
	if b := decode(t, f).Bounds(); b.Dx() != 320 || b.Dy() != 160 {
		t.Fatalf("unexpected variant size %v", b)
	}
	f.Close()

	cached := filepath.Join(dir, storageRoot, "ws", "big_w320.jpg")
	if _, err := os.Stat(cached); err != nil {
		t.Fatalf("expected cached variant: %v", err)
	}
	// Served from the cache even once the original is gone.
	if err := s.Delete([]string{"ws", "big.jpg"}); err != nil {
		t.Fatal(err)
	}
	f, name, err = svc.Variant("ws", "big.jpg", 320)
	if err != nil || name != "big_w320.jpg" {
		t.Fatalf("expected cached variant, got %q err %v", name, err)
	}
	f.Close()

	svc.DeleteVariants("ws", "big.jpg")
	if _, err := os.Stat(cached); !os.IsNotExist(err) {
		t.Fatalf("expected variant to be deleted, stat err %v", err)
	}
}

func TestVariantServesSmallAndUnsupportedOriginals(t *testing.T) {
	s, _ := newStorage(t)
	save(t, s, "small.jpg", encodeJPEG(t, solid(200, 100, color.White), 0))
	save(t, s, "anim.gif", []byte("GIF89a"))
	svc := NewService(s, nil)

	for _, name := range []string{"small.jpg", "anim.gif"} {
		f, served, err := svc.Variant("ws", name, 640)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		f.Close()
		if served != name {
			t.Errorf("%s: expected original, got %q", name, served)
		}
	}
}

func TestVariantKeepsTransparency(t *testing.T) {
	s, _ := newStorage(t)
	save(t, s, "alpha.png", encodePNG(t, solid(1000, 1000, color.NRGBA{255, 0, 0, 128})))
	save(t, s, "opaque.png", encodePNG(t, solid(1000, 1000, color.NRGBA{255, 0, 0, 255})))
	svc := NewService(s, nil)

	for name, want := range map[string]string{"alpha.png": "alpha_w640.png", "opaque.png": "opaque_w640.jpg"} {
		f, served, err := svc.Variant("ws", name, 640)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		f.Close()
		if served != want {
			t.Errorf("%s: got %q, want %q", name, served, want)
		}
		// The second lookup finds whichever format was cached.
		f, served, _ = svc.Variant("ws", name, 640)
		f.Close()
		if served != want {
			t.Errorf("%s cached: got %q, want %q", name, served, want)
		}
	}
}

func TestVariantAppliesOrientation(t *testing.T) {
	s, _ := newStorage(t)
	// Stored landscape, displayed portrait.
	save(t, s, "phone.jpg", encodeJPEG(t, solid(2000, 1000, color.White), 6))
	svc := NewService(s, nil)

	f, _, err := svc.Variant("ws", "phone.jpg", 640)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if b := decode(t, f).Bounds(); b.Dx() != 640 || b.Dy() != 1280 {
		t.Fatalf("expected 640x1280 portrait variant, got %v", b)
	}
}

type fakeFiles struct {
	files map[string]model.File
	dims  map[string][2]int
}

func (f *fakeFiles) FindFilesMissingDimensions(afterID string, exts []string, limit int) ([]model.File, error) {
	var out []model.File
	for _, id := range []string{"a", "b", "c"} {
		file, ok := f.files[id]
		if !ok || id <= afterID {
			continue
		}
		if _, done := f.dims[id]; done {
			continue
		}
		out = append(out, file)
		if len(out) == limit {
			break
		}
	}
	return out, nil
}

func (f *fakeFiles) UpdateFileDimensions(id string, w, h int) error {
	f.dims[id] = [2]int{w, h}
	return nil
}

func TestBackfill(t *testing.T) {
	s, _ := newStorage(t)
	save(t, s, "a.jpg", encodeJPEG(t, solid(30, 10, color.White), 6))
	save(t, s, "b.png", []byte("broken"))
	files := &fakeFiles{
		files: map[string]model.File{
			"a": {ID: "a", WorkspaceID: "ws", Name: "a.jpg"},
			"b": {ID: "b", WorkspaceID: "ws", Name: "b.png"},
			"c": {ID: "c", WorkspaceID: "ws", Name: "missing.jpg"},
		},
		dims: map[string][2]int{},
	}
	svc := NewService(s, files)

	n, err := svc.Backfill(context.Background())
	if err != nil || n != 3 {
		t.Fatalf("backfill: n=%d err=%v", n, err)
	}
	want := map[string][2]int{"a": {10, 30}, "b": {0, 0}, "c": {0, 0}}
	for id, d := range want {
		if files.dims[id] != d {
			t.Errorf("%s: got %v, want %v", id, files.dims[id], d)
		}
	}
	// Nothing left to do on the next start.
	if n, _ := svc.Backfill(context.Background()); n != 0 {
		t.Errorf("expected no work on second run, got %d", n)
	}
}
