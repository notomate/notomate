// Package dbcopy copies a Notomate database from one driver to another
// (e.g. sqlite3 to mysql), table by table, through database/sql.
package dbcopy

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/notomate/notomate/internal/bootstrap"
)

// Endpoint names a database by driver ("sqlite3", "postgres" or "mysql") and DSN.
type Endpoint struct {
	Driver string
	DSN    string
}

type fk struct {
	column string
	parent string
	// nullable references are set to NULL when they are empty or point at a
	// missing row, instead of dropping the row.
	nullable bool
}

type table struct {
	name string
	fks  []fk
	// selfRef is a nullable column referencing this same table; it is filled
	// in after all rows are inserted so parents need not come first.
	selfRef string
}

// tables lists every table in an order where referenced tables come first.
// The foreign keys mirror the migrations. SQLite never enforced them, so a
// SQLite database can hold rows whose parent is gone (e.g. notes of a deleted
// workspace); those are skipped because MySQL and PostgreSQL would reject them.
var tables = []table{
	{name: "users"},
	{name: "workspaces"},
	{name: "workspace_users", fks: []fk{{column: "user_id", parent: "users"}, {column: "workspace_id", parent: "workspaces"}}},
	{name: "notes", fks: []fk{{column: "workspace_id", parent: "workspaces"}}, selfRef: "parent_id"},
	{name: "files", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "views", fks: []fk{{column: "workspace_id", parent: "workspaces"}, {column: "note_id", parent: "notes", nullable: true}}},
	{name: "view_objects", fks: []fk{{column: "view_id", parent: "views"}}},
	{name: "widgets", fks: []fk{{column: "workspace_id", parent: "workspaces"}}, selfRef: "parent_id"},
	{name: "api_keys", fks: []fk{{column: "user_id", parent: "users"}}},
	{name: "yjs_documents"},
	{name: "workflows", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "workflow_runs", fks: []fk{{column: "workflow_id", parent: "workflows"}}},
	{name: "workflow_jobs", fks: []fk{{column: "run_id", parent: "workflow_runs"}}},
	{name: "workflow_job_logs", fks: []fk{{column: "job_id", parent: "workflow_jobs"}}},
	{name: "runners"},
	{name: "settings"},
	{name: "workflow_vars", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "workflow_secrets", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "workflow_files", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "comments", fks: []fk{{column: "note_id", parent: "notes"}, {column: "workspace_id", parent: "workspaces"}}},
	{name: "channels", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "messages", fks: []fk{{column: "channel_id", parent: "channels"}, {column: "workspace_id", parent: "workspaces"}}},
	{name: "workspace_integrations", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "google_maps_cache", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "action_sources", fks: []fk{{column: "workspace_id", parent: "workspaces"}}},
	{name: "marketplace_actions", fks: []fk{{column: "source_id", parent: "action_sources"}, {column: "workspace_id", parent: "workspaces"}}},
	{name: "note_files"},
	{name: "backfills"},
}

const migrationsTable = "schema_migrations"

// Limits for one multi-row INSERT: bound parameters (SQLite allows 32766)
// and approximate payload bytes (MySQL's max_allowed_packet defaults to 64MB).
const (
	maxBatchParams = 5000
	maxBatchBytes  = 4 << 20
)

// Copy migrates the target to the latest schema and copies every row from
// the source into it, in one transaction. The source must already be on the
// latest schema and the target must hold no data. Progress goes to out.
func Copy(from, to Endpoint, out io.Writer) error {
	if from.Driver == to.Driver && from.DSN == to.DSN {
		return errors.New("source and target are the same database")
	}

	if err := bootstrap.RunMigrationFor(to.Driver, to.DSN); err != nil {
		return fmt.Errorf("migrate target: %w", err)
	}

	src, err := sql.Open(from.Driver, from.DSN)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer src.Close()
	dst, err := sql.Open(to.Driver, to.DSN)
	if err != nil {
		return fmt.Errorf("open target: %w", err)
	}
	defer dst.Close()

	if err := checkVersions(src, dst); err != nil {
		return err
	}
	if err := checkTables(dst, to.Driver); err != nil {
		return err
	}
	if err := checkEmpty(dst, to.Driver); err != nil {
		return err
	}

	tx, err := dst.Begin()
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	c := copier{src: src, tx: tx, from: from.Driver, to: to.Driver, ids: map[string]map[string]bool{}, out: out}
	for _, t := range tables {
		if err := c.copyTable(t); err != nil {
			return fmt.Errorf("copy %s: %w", t.name, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

func schemaVersion(db *sql.DB) (int64, bool, error) {
	var version int64
	var dirty bool
	err := db.QueryRow("SELECT version, dirty FROM "+migrationsTable).Scan(&version, &dirty)
	return version, dirty, err
}

func checkVersions(src, dst *sql.DB) error {
	srcVersion, srcDirty, err := schemaVersion(src)
	if err != nil {
		return fmt.Errorf("read source schema version (is it a Notomate database?): %w", err)
	}
	dstVersion, _, err := schemaVersion(dst)
	if err != nil {
		return fmt.Errorf("read target schema version: %w", err)
	}
	if srcDirty {
		return fmt.Errorf("source schema is dirty at version %d; fix the failed migration first", srcVersion)
	}
	if srcVersion != dstVersion {
		return fmt.Errorf("source schema is at version %d but this build is at %d; start Notomate once against the source so it migrates, then retry", srcVersion, dstVersion)
	}
	return nil
}

// checkTables fails when the schema has a table this package doesn't know,
// so a new migration can't silently be left out of the copy.
func checkTables(db *sql.DB, driver string) error {
	var query string
	switch driver {
	case "sqlite3":
		query = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
	case "postgres":
		query = "SELECT tablename FROM pg_tables WHERE schemaname = current_schema()"
	case "mysql":
		query = "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
	default:
		return fmt.Errorf("unsupported database driver: %s", driver)
	}
	rows, err := db.Query(query)
	if err != nil {
		return fmt.Errorf("list target tables: %w", err)
	}
	defer rows.Close()

	known := map[string]bool{migrationsTable: true}
	for _, t := range tables {
		known[t.name] = true
	}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		if !known[name] {
			return fmt.Errorf("table %s is not handled by the database copy; add it to dbcopy.tables", name)
		}
	}
	return rows.Err()
}

func checkEmpty(db *sql.DB, driver string) error {
	for _, t := range tables {
		var n int64
		if err := db.QueryRow("SELECT COUNT(*) FROM " + quote(driver, t.name)).Scan(&n); err != nil {
			return fmt.Errorf("count target %s: %w", t.name, err)
		}
		if n > 0 {
			return fmt.Errorf("target table %s already has %d rows; copy into an empty database", t.name, n)
		}
	}
	return nil
}

type copier struct {
	src      *sql.DB
	tx       *sql.Tx
	from, to string
	// ids holds the copied ids of each table, to drop orphaned rows.
	ids map[string]map[string]bool
	out io.Writer
}

type columnKind int

const (
	kindText columnKind = iota
	kindBool
	kindInt
	kindBinary
)

func kindOf(databaseType string) columnKind {
	t := strings.ToUpper(databaseType)
	switch {
	case strings.Contains(t, "BOOL"), t == "TINYINT":
		return kindBool
	case strings.Contains(t, "INT"):
		return kindInt
	case strings.Contains(t, "BLOB"), strings.Contains(t, "BYTEA"), strings.Contains(t, "BINARY"):
		return kindBinary
	}
	return kindText
}

// targetColumns returns the target's columns of t and their kinds.
func (c *copier) targetColumns(t string) ([]string, []columnKind, error) {
	rows, err := c.tx.Query("SELECT * FROM " + quote(c.to, t) + " WHERE 1 = 0")
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	types, err := rows.ColumnTypes()
	if err != nil {
		return nil, nil, err
	}
	names := make([]string, len(types))
	kinds := make([]columnKind, len(types))
	for i, ct := range types {
		names[i] = ct.Name()
		kinds[i] = kindOf(ct.DatabaseTypeName())
	}
	return names, kinds, rows.Err()
}

func (c *copier) copyTable(t table) error {
	cols, kinds, err := c.targetColumns(t.name)
	if err != nil {
		return err
	}
	colIndex := map[string]int{}
	quoted := make([]string, len(cols))
	for i, col := range cols {
		colIndex[col] = i
		quoted[i] = quote(c.from, col)
	}

	rows, err := c.src.Query("SELECT " + strings.Join(quoted, ", ") + " FROM " + quote(c.from, t.name))
	if err != nil {
		return err
	}
	defer rows.Close()

	idCol, hasID := colIndex["id"]
	selfCol, hasSelf := colIndex[t.selfRef]
	type selfLink struct{ id, parent string }
	var links []selfLink
	if hasID {
		c.ids[t.name] = map[string]bool{}
	}

	ins := newInserter(c.tx, c.to, t.name, cols)
	copied, skipped := 0, 0
	for rows.Next() {
		row := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range row {
			ptrs[i] = &row[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return err
		}
		for i := range row {
			if row[i], err = coerce(row[i], kinds[i]); err != nil {
				return fmt.Errorf("column %s: %w", cols[i], err)
			}
		}

		if !c.resolveFKs(t, row, colIndex) {
			skipped++
			continue
		}
		if hasSelf && t.selfRef != "" {
			if parent := asString(row[selfCol]); parent != "" && hasID {
				links = append(links, selfLink{id: asString(row[idCol]), parent: parent})
			}
			row[selfCol] = nil
		}

		if err := ins.add(row); err != nil {
			return err
		}
		if hasID {
			c.ids[t.name][asString(row[idCol])] = true
		}
		copied++
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if err := ins.flush(); err != nil {
		return err
	}

	// Self references whose parent wasn't copied stay NULL (a root row).
	if len(links) > 0 {
		stmt, err := c.tx.Prepare(fmt.Sprintf("UPDATE %s SET %s = %s WHERE %s = %s",
			quote(c.to, t.name), quote(c.to, t.selfRef), placeholder(c.to, 1), quote(c.to, "id"), placeholder(c.to, 2)))
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, l := range links {
			if !c.ids[t.name][l.parent] {
				continue
			}
			if _, err := stmt.Exec(l.parent, l.id); err != nil {
				return err
			}
		}
	}

	if skipped > 0 {
		fmt.Fprintf(c.out, "  %-24s %d rows (%d orphaned rows skipped)\n", t.name, copied, skipped)
	} else {
		fmt.Fprintf(c.out, "  %-24s %d rows\n", t.name, copied)
	}
	return nil
}

// resolveFKs reports whether the row's references all exist in the target,
// clearing empty or dangling nullable ones.
func (c *copier) resolveFKs(t table, row []any, colIndex map[string]int) bool {
	for _, f := range t.fks {
		i, ok := colIndex[f.column]
		if !ok || row[i] == nil {
			continue
		}
		ref := asString(row[i])
		if f.nullable && ref == "" {
			row[i] = nil
			continue
		}
		if !c.ids[f.parent][ref] {
			return false
		}
	}
	return true
}

func asString(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case []byte:
		return string(x)
	}
	return fmt.Sprint(v)
}

// coerce converts a value read from the source into what the target column
// expects: drivers disagree on booleans (0/1 vs true), and some return text
// and numbers as []byte.
func coerce(v any, kind columnKind) (any, error) {
	if v == nil {
		return nil, nil
	}
	switch kind {
	case kindBool:
		switch x := v.(type) {
		case bool:
			return x, nil
		case int64:
			return x != 0, nil
		case float64:
			return x != 0, nil
		default:
			s := strings.ToLower(asString(v))
			return s == "1" || s == "t" || s == "true", nil
		}
	case kindInt:
		switch x := v.(type) {
		case int64:
			return x, nil
		case float64:
			return int64(x), nil
		case bool:
			if x {
				return int64(1), nil
			}
			return int64(0), nil
		default:
			return strconv.ParseInt(asString(v), 10, 64)
		}
	case kindBinary:
		if s, ok := v.(string); ok {
			return []byte(s), nil
		}
		return v, nil
	}
	if b, ok := v.([]byte); ok {
		return string(b), nil
	}
	return v, nil
}

func quote(driver, ident string) string {
	if driver == "mysql" {
		return "`" + ident + "`"
	}
	return `"` + ident + `"`
}

func placeholder(driver string, n int) string {
	if driver == "postgres" {
		return "$" + strconv.Itoa(n)
	}
	return "?"
}

// inserter batches rows into multi-row INSERT statements.
type inserter struct {
	tx      *sql.Tx
	driver  string
	prefix  string
	ncols   int
	maxRows int
	rows    [][]any
	bytes   int
}

func newInserter(tx *sql.Tx, driver, table string, cols []string) *inserter {
	quoted := make([]string, len(cols))
	for i, col := range cols {
		quoted[i] = quote(driver, col)
	}
	maxRows := maxBatchParams / len(cols)
	if maxRows < 1 {
		maxRows = 1
	}
	return &inserter{
		tx:      tx,
		driver:  driver,
		prefix:  "INSERT INTO " + quote(driver, table) + " (" + strings.Join(quoted, ", ") + ") VALUES ",
		ncols:   len(cols),
		maxRows: maxRows,
	}
}

func (in *inserter) add(row []any) error {
	in.rows = append(in.rows, row)
	for _, v := range row {
		switch x := v.(type) {
		case string:
			in.bytes += len(x)
		case []byte:
			in.bytes += len(x)
		default:
			in.bytes += 8
		}
	}
	if len(in.rows) >= in.maxRows || in.bytes >= maxBatchBytes {
		return in.flush()
	}
	return nil
}

func (in *inserter) flush() error {
	if len(in.rows) == 0 {
		return nil
	}
	var sb strings.Builder
	sb.WriteString(in.prefix)
	args := make([]any, 0, len(in.rows)*in.ncols)
	n := 0
	for r, row := range in.rows {
		if r > 0 {
			sb.WriteString(", ")
		}
		sb.WriteString("(")
		for i, v := range row {
			if i > 0 {
				sb.WriteString(", ")
			}
			n++
			sb.WriteString(placeholder(in.driver, n))
			args = append(args, v)
		}
		sb.WriteString(")")
	}
	if _, err := in.tx.Exec(sb.String(), args...); err != nil {
		return err
	}
	in.rows = in.rows[:0]
	in.bytes = 0
	return nil
}
