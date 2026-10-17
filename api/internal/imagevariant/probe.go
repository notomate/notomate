package imagevariant

import (
	"bytes"
	"encoding/binary"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"strings"

	_ "golang.org/x/image/webp"
)

// ProbeBytes is how much of a file's head ProbeDimensions needs. JPEG
// headers can carry several 64 KB APP segments (EXIF, ICC, MPF) before the
// frame header.
const ProbeBytes = 512 << 10

// ProbeExts are the extensions whose dimensions can be probed.
var ProbeExts = []string{".jpg", ".jpeg", ".png", ".webp", ".gif"}

// IsProbeable reports whether files with this extension have dimensions.
func IsProbeable(ext string) bool {
	ext = strings.ToLower(ext)
	for _, e := range ProbeExts {
		if e == ext {
			return true
		}
	}
	return false
}

// ProbeDimensions returns the displayed width and height of the image whose
// first bytes are header, i.e. with EXIF orientation applied the way
// browsers do.
func ProbeDimensions(header []byte) (width, height int, ok bool) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(header))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return 0, 0, false
	}
	if swapsAxes(jpegOrientation(header)) {
		return cfg.Height, cfg.Width, true
	}
	return cfg.Width, cfg.Height, true
}

// Probe reads the head of r and returns its displayed dimensions.
func Probe(r io.Reader) (width, height int, ok bool) {
	header, err := io.ReadAll(io.LimitReader(r, ProbeBytes))
	if err != nil {
		return 0, 0, false
	}
	return ProbeDimensions(header)
}

// swapsAxes reports whether an EXIF orientation rotates the image by 90°.
func swapsAxes(orientation int) bool {
	return orientation >= 5 && orientation <= 8
}

// jpegOrientation returns the EXIF orientation tag of a JPEG (1 when absent
// or not a JPEG).
func jpegOrientation(b []byte) int {
	if len(b) < 4 || b[0] != 0xFF || b[1] != 0xD8 {
		return 1
	}
	i := 2
	for i+4 <= len(b) {
		if b[i] != 0xFF {
			return 1
		}
		marker := b[i+1]
		if marker == 0xFF {
			// Fill byte.
			i++
			continue
		}
		if marker == 0xDA || marker == 0xD9 {
			// Start of scan / end of image: no more metadata.
			return 1
		}
		size := int(binary.BigEndian.Uint16(b[i+2:]))
		if size < 2 || i+2+size > len(b) {
			return 1
		}
		seg := b[i+4 : i+2+size]
		if marker == 0xE1 && len(seg) > 6 && string(seg[:6]) == "Exif\x00\x00" {
			return tiffOrientation(seg[6:])
		}
		i += 2 + size
	}
	return 1
}

func tiffOrientation(t []byte) int {
	if len(t) < 8 {
		return 1
	}
	var order binary.ByteOrder
	switch string(t[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 1
	}
	ifd := int(order.Uint32(t[4:]))
	if ifd < 8 || ifd+2 > len(t) {
		return 1
	}
	n := int(order.Uint16(t[ifd:]))
	for k := 0; k < n; k++ {
		e := ifd + 2 + k*12
		if e+12 > len(t) {
			return 1
		}
		if order.Uint16(t[e:]) == 0x0112 {
			v := int(order.Uint16(t[e+8:]))
			if v < 1 || v > 8 {
				return 1
			}
			return v
		}
	}
	return 1
}
