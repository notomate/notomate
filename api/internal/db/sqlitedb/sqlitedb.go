package sqlitedb

import (
	"context"
	"errors"

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
	dsn := config.C.GetString(config.DB_DSN)

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})

	return &SqliteDB{db: db}, err
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
