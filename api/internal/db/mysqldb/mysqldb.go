package mysqldb

import (
	"context"
	"errors"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type MySQLDB struct {
	db   *gorm.DB
	tx   *gorm.DB
	inTx bool
}

func NewMySQLDB() (db.DB, error) {
	dsn := config.C.GetString(config.DB_DSN)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})

	return &MySQLDB{db: db}, err
}

func (u *MySQLDB) Begin(c context.Context) (db.DB, error) {
	if u.inTx {
		return nil, errors.New("transaction already started")
	}
	tx := u.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	return &MySQLDB{db: u.db, tx: tx, inTx: true}, nil
}
func (u *MySQLDB) Commit() error {
	if !u.inTx {
		return errors.New("no active transaction")
	}
	err := u.tx.Commit().Error
	u.tx = nil
	u.inTx = false
	return err
}
func (u *MySQLDB) Rollback() error {
	if !u.inTx {
		return errors.New("no active transaction")
	}
	err := u.tx.Rollback().Error
	u.tx = nil
	u.inTx = false
	return err
}
func (u *MySQLDB) getDB() *gorm.DB {
	if u.inTx {
		return u.tx
	}
	return u.db
}
