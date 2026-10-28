package sqlitedb

import (
	"context"
	"errors"
	"strings"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type SqliteDB struct {
	db   *gorm.DB
	tx   *gorm.DB
	inTx bool
}

func NewSqliteDB() (db.DB, error) {
	dsn := withConcurrencyParams(config.C.GetString(config.DB_DSN))

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})

	return &SqliteDB{db: db}, err
}

// withConcurrencyParams makes concurrent writers wait for each other instead
// of failing at once with "database is locked" (e.g. two schedules firing in
// the same minute): a busy timeout, WAL so readers don't block the writer,
// and immediate transactions so a transaction takes the write lock up front
// rather than failing when it upgrades from a read. Parameters already in the
// DSN are left alone.
func withConcurrencyParams(dsn string) string {
	params := []string{"_busy_timeout=5000", "_journal_mode=WAL", "_txlock=immediate"}
	for _, p := range params {
		key := p[:strings.Index(p, "=")+1]
		if strings.Contains(dsn, key) {
			continue
		}
		if strings.Contains(dsn, "?") {
			dsn += "&" + p
		} else {
			dsn += "?" + p
		}
	}
	return dsn
}

func (u *SqliteDB) Begin(c context.Context) (db.DB, error) {
	if u.inTx {
		return nil, errors.New("transaction already started")
	}
	tx := u.db.Begin()
	if tx.Error != nil {
		return nil, u.tx.Error
	}
	return &SqliteDB{db: u.db, tx: tx, inTx: true}, nil
}
func (u *SqliteDB) Commit() error {
	if !u.inTx {
		return errors.New("no active transaction")
	}
	err := u.tx.Commit().Error
	u.tx = nil
	u.inTx = false
	return err
}
func (u *SqliteDB) Rollback() error {
	if !u.inTx {
		return errors.New("no active transaction")
	}
	err := u.tx.Rollback().Error
	u.tx = nil
	u.inTx = false
	return err
}
func (u *SqliteDB) getDB() *gorm.DB {
	if u.inTx {
		return u.tx
	}
	return u.db
}
