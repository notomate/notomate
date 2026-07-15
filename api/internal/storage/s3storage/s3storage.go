package s3storage

import (
	"context"
	"io"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/notomate/notomate/internal/storage"
)

type S3Storage struct {
	client *minio.Client
	bucket string
}

type S3Config struct {
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	UseSSL          bool
}

func NewS3Storage(cfg S3Config) (storage.Storage, error) {
	minioClient, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, err
	}

	return &S3Storage{
		client: minioClient,
		bucket: cfg.Bucket,
	}, nil
}

func (s *S3Storage) Save(segments []string, reader io.Reader) error {
	key := strings.Join(segments, "/")

	// Upload the file with default options
	_, err := s.client.PutObject(
		context.Background(),
		s.bucket,
		key,
		reader,
		-1, // size unknown, will use multipart upload
		minio.PutObjectOptions{},
	)

	return err
}

func (s *S3Storage) Load(segments []string) (io.ReadSeekCloser, error) {
	key := strings.Join(segments, "/")

	object, err := s.client.GetObject(
		context.Background(),
		s.bucket,
		key,
		minio.GetObjectOptions{},
	)
	if err != nil {
		return nil, err
	}

	return object, nil
}

func (s *S3Storage) Delete(segments []string) error {
	key := strings.Join(segments, "/")

	err := s.client.RemoveObject(
		context.Background(),
		s.bucket,
		key,
		minio.RemoveObjectOptions{},
	)

	return err
}
