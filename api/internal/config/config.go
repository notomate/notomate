package config

import (
	"github.com/spf13/viper"
)

type DatabaseConfig struct {
	Driver  string
	DSN     string
	MaxIdle int
	MaxOpen int
}

type StorageConfig struct {
	Type string
	Root string
	// S3/MinIO Configuration
	S3Endpoint        string
	S3AccessKeyID     string
	S3SecretAccessKey string
	S3Bucket          string
	S3UseSSL          bool
}

type ServerConfig struct {
	ApiRootPath string
	Port        string
	Timeout     int
}

type AppConfig struct {
	DB      DatabaseConfig
	Storage StorageConfig
	Server  ServerConfig
}

var C *viper.Viper

const (
	DB_DRIVER             = "db_driver"
	DB_DSN                = "db_dsn"
	STORAGE_TYPE          = "storage_type"
	STORAGE_ROOT          = "storage_root"
	STORAGE_S3_ENDPOINT   = "storage_s3_endpoint"
	STORAGE_S3_ACCESS_KEY = "storage_s3_access_key"
	STORAGE_S3_SECRET_KEY = "storage_s3_secret_key"
	STORAGE_S3_BUCKET     = "storage_s3_bucket"
	STORAGE_S3_USE_SSL    = "storage_s3_use_ssl"
	SERVER_API_ROOT_PATH  = "server_api_root_path"
	APP_DISABLE_SIGNUP    = "app_disable_signup"
	APP_SECRET            = "app_secret"
	GRPC_PORT             = "grpc_port"

	RUNNER_REGISTRATION_TOKEN      = "runner_registration_token"
	WORKFLOW_NOTE_DEBOUNCE_SECONDS = "workflow_note_debounce_seconds"
	WORKFLOW_LOG_MAX_LINES         = "workflow_log_max_lines"
	WORKFLOW_RUN_RETENTION_DAYS    = "workflow_run_retention_days"
)

func Init() {
	C = viper.New()

	C.SetDefault(DB_DRIVER, "sqlite3")
	C.SetDefault(DB_DSN, "bin/collabreef.db")
	C.SetDefault(STORAGE_TYPE, "local")
	C.SetDefault(STORAGE_ROOT, "./bin/uploads/")
	C.SetDefault(STORAGE_S3_ENDPOINT, "localhost:9000")
	C.SetDefault(STORAGE_S3_ACCESS_KEY, "")
	C.SetDefault(STORAGE_S3_SECRET_KEY, "")
	C.SetDefault(STORAGE_S3_BUCKET, "collabreef")
	C.SetDefault(STORAGE_S3_USE_SSL, false)
	C.SetDefault(SERVER_API_ROOT_PATH, "/api/v1")
	C.SetDefault(APP_DISABLE_SIGNUP, false)
	C.SetDefault(APP_SECRET, "default_secret")
	C.SetDefault(GRPC_PORT, "50051")
	C.SetDefault(RUNNER_REGISTRATION_TOKEN, "")
	C.SetDefault(WORKFLOW_NOTE_DEBOUNCE_SECONDS, 10)
	C.SetDefault(WORKFLOW_LOG_MAX_LINES, 10000)
	C.SetDefault(WORKFLOW_RUN_RETENTION_DAYS, 30)

	C.AutomaticEnv()
}
