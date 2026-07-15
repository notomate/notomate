package storage

import "io"

type Storage interface {
	Save(segments []string, reader io.Reader) error
	Load(segments []string) (io.ReadSeekCloser, error)
	Delete(segments []string) error
}
