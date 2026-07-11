package bootstrap

import (
	"fmt"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/storage"
	"github.com/notomate/notomate/internal/storage/localfile"
	"github.com/notomate/notomate/internal/storage/s3storage"
)

func NewStorage() (storage.Storage, error) {
	storageType := config.C.GetString(config.STORAGE_TYPE)
	storageRoot := config.C.GetString(config.STORAGE_ROOT)

	switch storageType {
	case "local":
		return localfile.NewLocalFileStorage(storageRoot), nil
	case "s3", "minio":
		s3Config := s3storage.S3Config{
			Endpoint:        config.C.GetString(config.STORAGE_S3_ENDPOINT),
			AccessKeyID:     config.C.GetString(config.STORAGE_S3_ACCESS_KEY),
			SecretAccessKey: config.C.GetString(config.STORAGE_S3_SECRET_KEY),
			Bucket:          config.C.GetString(config.STORAGE_S3_BUCKET),
			UseSSL:          config.C.GetBool(config.STORAGE_S3_USE_SSL),
		}
		return s3storage.NewS3Storage(s3Config)
	}

	return nil, fmt.Errorf("unsupported storage type: %s", storageType)
}
