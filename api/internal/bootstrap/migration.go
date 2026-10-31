package bootstrap

import (
	"database/sql"
	"fmt"
	"log"
	"strings"

	"github.com/notomate/notomate/internal/config"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigration() error {
	return RunMigrationFor(config.C.GetString(config.DB_DRIVER), config.C.GetString(config.DB_DSN))
}

// RunMigrationFor applies the migrations of the given driver to the database
// at dsn, independent of the configured database.
func RunMigrationFor(driver, dsn string) error {
	switch driver {
	case "sqlite3":
		return runSqlite3Migrations(dsn)
	case "postgres":
		return runPostgresMigrations(dsn)
	case "mysql":
		return runMySQLMigrations(dsn)
	}

	return fmt.Errorf("unsupported database driver: %s", driver)
}

func runSqlite3Migrations(dsn string) error {
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		log.Fatal(err)
	}

	migrateInstance, err := migrate.NewWithDatabaseInstance(
		"file://migrations/sqlite3",
		"main",
		driver,
	)

	if err != nil {
		return fmt.Errorf("Error creating migration instance: %w", err)
	}

	if err := migrateInstance.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("Error applying migrations: %w", err)
	}

	fmt.Println("Migrations applied successfully!")
	return nil
}

func runPostgresMigrations(dsn string) error {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		log.Fatal(err)
	}

	migrateInstance, err := migrate.NewWithDatabaseInstance(
		"file://migrations/postgres",
		"postgres",
		driver,
	)

	if err != nil {
		return fmt.Errorf("Error creating migration instance: %w", err)
	}

	if err := migrateInstance.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("Error applying migrations: %w", err)
	}

	fmt.Println("Migrations applied successfully!")
	return nil
}

func runMySQLMigrations(dsn string) error {
	// Migration files hold several statements each, which the MySQL driver
	// only accepts with multiStatements enabled.
	if !strings.Contains(dsn, "multiStatements=") {
		if strings.Contains(dsn, "?") {
			dsn += "&multiStatements=true"
		} else {
			dsn += "?multiStatements=true"
		}
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	driver, err := mysql.WithInstance(db, &mysql.Config{})
	if err != nil {
		log.Fatal(err)
	}

	migrateInstance, err := migrate.NewWithDatabaseInstance(
		"file://migrations/mysql",
		"mysql",
		driver,
	)

	if err != nil {
		return fmt.Errorf("Error creating migration instance: %w", err)
	}

	if err := migrateInstance.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("Error applying migrations: %w", err)
	}

	fmt.Println("Migrations applied successfully!")
	return nil
}
