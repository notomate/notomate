package postgresdb

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratepostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// newTestDB creates a fresh, migrated database on the PostgreSQL server named
// by NOTOMATE_TEST_POSTGRES_DSN (a URL for a user allowed to create
// databases, e.g. "postgres://postgres:pw@127.0.0.1:5432/postgres?sslmode=disable"),
// and skips the test when it is unset.
func newTestDB(t *testing.T) *PostgresDB {
	t.Helper()

	baseDSN := os.Getenv("NOTOMATE_TEST_POSTGRES_DSN")
	if baseDSN == "" {
		t.Skip("NOTOMATE_TEST_POSTGRES_DSN not set")
	}
	u, err := url.Parse(baseDSN)
	if err != nil {
		t.Fatalf("parse dsn: %v", err)
	}

	admin, err := sql.Open("postgres", baseDSN)
	if err != nil {
		t.Fatalf("open postgres: %v", err)
	}
	defer admin.Close()
	name := fmt.Sprintf("notomate_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	t.Cleanup(func() {
		if conn, err := sql.Open("postgres", baseDSN); err == nil {
			conn.Exec("DROP DATABASE " + name + " WITH (FORCE)")
			conn.Close()
		}
	})

	u.Path = "/" + name
	dsn := u.String()
	sqlDB, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	driver, err := migratepostgres.WithInstance(sqlDB, &migratepostgres.Config{})
	if err != nil {
		t.Fatalf("migrate driver: %v", err)
	}
	m, err := migrate.NewWithDatabaseInstance("file://../../../migrations/postgres", "postgres", driver)
	if err != nil {
		t.Fatalf("migrate instance: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("apply migrations: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close migration connection: %v", err)
	}

	gdb, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open gorm: %v", err)
	}
	t.Cleanup(func() {
		if conn, err := gdb.DB(); err == nil {
			conn.Close()
		}
	})
	return &PostgresDB{db: gdb}
}
