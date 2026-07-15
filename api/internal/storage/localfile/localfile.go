package localfile

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/notomate/notomate/internal/storage"
)

type LocalFile struct {
	root string
}

func NewLocalFileStorage(root string) storage.Storage {
	return &LocalFile{root: root}
}

func (l LocalFile) Save(segments []string, r io.Reader) error {
	uploadPath := l.root + strings.Join(segments, "/")

	fp := filepath.Dir(uploadPath)

	if err := os.MkdirAll(fp, os.ModePerm); err != nil {
		return errors.New("Failed to create upload directory")
	}

	f, err := os.Create(uploadPath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (l *LocalFile) Load(segments []string) (io.ReadSeekCloser, error) {
	uploadPath := l.root + strings.Join(segments, "/")
	f, err := os.Open(uploadPath)
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (l *LocalFile) Delete(segments []string) error {
	uploadPath := l.root + strings.Join(segments, "/")
	return os.Remove(uploadPath)
}
