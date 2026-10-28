package notefile

import (
	"context"
	"fmt"
	"log"
	"sync/atomic"

	"github.com/notomate/notomate/internal/db"
)

const (
	backfillName  = "note_files"
	backfillBatch = 200
)

var complete atomic.Bool

// Complete reports whether note_files covers every note and comment. Until
// then file downloads can't rely on it and keep their old open access.
func Complete() bool {
	return complete.Load()
}

// StartBackfill runs Backfill once in the background and stops when ctx is
// cancelled.
func StartBackfill(ctx context.Context, database db.DB) {
	go func() {
		if err := Backfill(ctx, database); err != nil {
			log.Printf("[notefile] backfill: %v", err)
		}
	}()
}

// Backfill records the files used by notes and comments written before
// note_files existed. It runs once: a completed run is recorded in the
// backfills table, and an interrupted one starts over on the next start
// (ReplaceNoteFiles makes rerunning safe).
func Backfill(ctx context.Context, database db.DB) error {
	done, err := database.IsBackfillDone(backfillName)
	if err != nil {
		return fmt.Errorf("check backfill: %w", err)
	}
	if done {
		complete.Store(true)
		return nil
	}

	notes, comments := 0, 0
	for afterID := ""; ; {
		batch, err := database.FindNotesAfter(afterID, backfillBatch)
		if err != nil {
			return fmt.Errorf("load notes: %w", err)
		}
		for _, n := range batch {
			if err := ctx.Err(); err != nil {
				return err
			}
			if err := database.ReplaceNoteFiles(n.WorkspaceID, n.ID, "", Extract(n.WorkspaceID, n.Content)); err != nil {
				return fmt.Errorf("note %s: %w", n.ID, err)
			}
		}
		notes += len(batch)
		if len(batch) < backfillBatch {
			break
		}
		afterID = batch[len(batch)-1].ID
	}
	for afterID := ""; ; {
		batch, err := database.FindCommentsAfter(afterID, backfillBatch)
		if err != nil {
			return fmt.Errorf("load comments: %w", err)
		}
		for _, c := range batch {
			if err := ctx.Err(); err != nil {
				return err
			}
			if err := database.ReplaceNoteFiles(c.WorkspaceID, c.NoteID, c.ID, Extract(c.WorkspaceID, c.Body)); err != nil {
				return fmt.Errorf("comment %s: %w", c.ID, err)
			}
		}
		comments += len(batch)
		if len(batch) < backfillBatch {
			break
		}
		afterID = batch[len(batch)-1].ID
	}

	if err := database.MarkBackfillDone(backfillName); err != nil {
		return fmt.Errorf("mark backfill done: %w", err)
	}
	complete.Store(true)
	log.Printf("[notefile] backfilled file references for %d notes and %d comments", notes, comments)
	return nil
}
