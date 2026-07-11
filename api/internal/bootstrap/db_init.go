package bootstrap

import (
	"fmt"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/db/postgresdb"
	"github.com/notomate/notomate/internal/db/sqlitedb"
)

func NewDB() (db.DB, error) {
	driver := config.C.GetString(config.DB_DRIVER)
	switch driver {
	case "sqlite3":
		return sqlitedb.NewSqliteDB()
	case "postgres":
		return postgresdb.NewPostgresDB()
	}

	return nil, fmt.Errorf("unsupported database driver: %s", driver)
}
