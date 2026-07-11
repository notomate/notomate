package postgresdb

import (
	"context"
	"errors"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/db"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type PostgresDB struct {
	db   *gorm.DB
	tx   *gorm.DB
	inTx bool
}

func NewPostgresDB() (db.DB, error) {
	dsn := config.C.GetString(config.DB_DSN)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})

	return &PostgresDB{db: db}, err
}

func (u *PostgresDB) Begin(c context.Context) (db.DB, error) {
	if u.inTx {
		return nil, errors.New("transaction already started")
	}
	tx := u.db.Begin()
	if tx.Error != nil {
		return nil, u.tx.Error
	}
	return &PostgresDB{db: u.db, tx: tx, inTx: true}, nil
}
func (u *PostgresDB) Commit() error {
	if !u.inTx {
		return errors.New("no active transaction")
	}
	err := u.tx.Commit().Error
	u.tx = nil
	u.inTx = false
	return err
}
func (u *PostgresDB) Rollback() error {
	if !u.inTx {
		return errors.New("no active transaction")
	}
	err := u.tx.Rollback().Error
	u.tx = nil
	u.inTx = false
	return err
}
func (u *PostgresDB) getDB() *gorm.DB {
	if u.inTx {
		return u.tx
	}
	return u.db
}
