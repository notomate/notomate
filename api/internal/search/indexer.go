package search

import (
	"context"
	"fmt"
	"log"
	"runtime/debug"
	"sync"
	"time"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
)

// Options tune the indexer; zero values take the defaults.
type Options struct {
	Workers      int           // concurrent index workers (default 2)
	ScanInterval time.Duration // how often to look for pending notes (default 3s)
	BatchSize    int           // pending notes fetched per scan (default 100)
	MaxRetries   int           // failures before a note is skipped until restart (default 3)
}

// orphanInterval is how often index rows of deleted notes are cleaned up.
const orphanInterval = time.Hour

// Indexer keeps the search index current. It runs in its own process
// (cmd/indexer), apart from the api: the api only flags changed notes by
// setting search_indexed_at to NULL, and the indexer polls for them.
//
// A scanner looks for notes whose search_indexed_at is NULL (new, changed,
// or never indexed) and queues them for a pool of workers, which claim each
// note, extract its index and store it. A change made while a note is being
// indexed resets the marker, so the note is simply indexed again.
type Indexer struct {
	db   db.DB
	opts Options
	jobs chan string
	wg   sync.WaitGroup

	mu       sync.Mutex
	inFlight map[string]bool
	failures map[string]int
}

func NewIndexer(database db.DB, opts Options) *Indexer {
	if opts.Workers <= 0 {
		opts.Workers = 2
	}
	if opts.ScanInterval <= 0 {
		opts.ScanInterval = 3 * time.Second
	}
	if opts.BatchSize <= 0 {
		opts.BatchSize = 100
	}
	if opts.MaxRetries <= 0 {
		opts.MaxRetries = 3
	}
	return &Indexer{
		db:       database,
		opts:     opts,
		jobs:     make(chan string, opts.BatchSize),
		inFlight: map[string]bool{},
		failures: map[string]int{},
	}
}

// MarkStale flags a note's index as outdated (e.g. a comment changed) so the
// indexer picks it up. Errors are logged: a failed mark must not fail the
// request that caused it.
func MarkStale(database db.DB, noteID string) {
	if err := database.MarkNoteUnindexed(noteID); err != nil {
		log.Printf("[search] mark note %s unindexed: %v", noteID, err)
	}
}

// Remove drops a deleted note's index rows.
func Remove(database db.DB, noteID string) {
	if err := database.DeleteNoteSearchIndex(noteID); err != nil {
		log.Printf("[search] remove note %s: %v", noteID, err)
	}
}

// Run indexes until ctx is cancelled, then waits for the notes being indexed
// to finish.
func (ix *Indexer) Run(ctx context.Context) {
	for i := 0; i < ix.opts.Workers; i++ {
		ix.wg.Add(1)
		go func() {
			defer ix.wg.Done()
			ix.worker(ctx)
		}()
	}
	ix.scanLoop(ctx)
	ix.wg.Wait()
}

func (ix *Indexer) scanLoop(ctx context.Context) {
	ticker := time.NewTicker(ix.opts.ScanInterval)
	defer ticker.Stop()
	claimsReset := false
	lastOrphan := time.Time{}
	for {
		// A previous indexer may have stopped mid-index; those notes are
		// pending again. Retried until it works, since the api may still be
		// migrating the database when the indexer starts.
		if !claimsReset {
			if err := ix.db.ResetSearchClaims(); err != nil {
				log.Printf("[search] reset claims (retrying): %v", err)
			} else {
				claimsReset = true
			}
		}
		more := false
		if claimsReset {
			ix.safely("scan", func() { more = ix.scan(ctx) })
			if time.Since(lastOrphan) >= orphanInterval {
				lastOrphan = time.Now()
				ix.safely("clean orphans", func() {
					if n, err := ix.db.DeleteOrphanSearchIndex(); err != nil {
						log.Printf("[search] clean orphans: %v", err)
					} else if n > 0 {
						log.Printf("[search] removed %d index rows of deleted notes", n)
					}
				})
			}
		}
		if more && ctx.Err() == nil {
			continue // backlog: keep going without waiting for the tick
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// scan queues pending notes that aren't already queued or being indexed. It
// reports whether there may be more pending notes than one batch held.
func (ix *Indexer) scan(ctx context.Context) bool {
	limit := ix.opts.BatchSize + ix.skippedCount()
	ids, err := ix.db.FindNotesToIndex(limit)
	if err != nil {
		log.Printf("[search] find pending notes: %v", err)
		return false
	}
	queued := 0
	for _, id := range ids {
		if !ix.reserve(id) {
			continue
		}
		select {
		case ix.jobs <- id:
			queued++
		case <-ctx.Done():
			ix.release(id)
			return false
		}
	}
	return queued > 0 && len(ids) >= limit
}

// safely runs fn, logging instead of crashing the process if it panics.
func (ix *Indexer) safely(what string, fn func()) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[search] %s panicked: %v\n%s", what, r, debug.Stack())
		}
	}()
	fn()
}

func (ix *Indexer) skippedCount() int {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	n := 0
	for _, f := range ix.failures {
		if f >= ix.opts.MaxRetries {
			n++
		}
	}
	return n
}

func (ix *Indexer) reserve(id string) bool {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	if ix.inFlight[id] || ix.failures[id] >= ix.opts.MaxRetries {
		return false
	}
	ix.inFlight[id] = true
	return true
}

func (ix *Indexer) release(id string) {
	ix.mu.Lock()
	delete(ix.inFlight, id)
	ix.mu.Unlock()
}

func (ix *Indexer) worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case id := <-ix.jobs:
			err := ix.IndexNote(id)
			ix.mu.Lock()
			delete(ix.inFlight, id)
			if err != nil {
				ix.failures[id]++
				if ix.failures[id] >= ix.opts.MaxRetries {
					log.Printf("[search] giving up on note %s until restart: %v", id, err)
				} else {
					log.Printf("[search] index note %s: %v", id, err)
				}
			} else {
				delete(ix.failures, id)
			}
			ix.mu.Unlock()
		}
	}
}

// IndexNote claims a pending note, extracts its index and stores it. A note
// that is gone or no longer pending is skipped. A panic while indexing is
// turned into an error, so one bad note can't stop the indexer.
func (ix *Indexer) IndexNote(noteID string) (err error) {
	defer recoverInto(&err)
	claimed, err := ix.db.ClaimNoteForIndexing(noteID)
	if err != nil || !claimed {
		return err
	}
	// Runs after the recover below, so a panic also returns the note to
	// pending and the next scan retries it.
	defer func() {
		if err != nil {
			if resetErr := ix.db.MarkNoteUnindexed(noteID); resetErr != nil {
				log.Printf("[search] reset note %s: %v", noteID, resetErr)
			}
		}
	}()
	defer recoverInto(&err)
	return ix.index(noteID)
}

func recoverInto(err *error) {
	if r := recover(); r != nil {
		*err = fmt.Errorf("panic: %v\n%s", r, debug.Stack())
	}
}

func (ix *Indexer) index(noteID string) error {
	note, err := ix.db.FindNote(model.Note{ID: noteID})
	if err != nil {
		return err
	}
	comments, err := ix.db.FindComments(model.CommentFilter{NoteID: noteID})
	if err != nil {
		return err
	}
	bodies := make([]string, 0, len(comments))
	for _, c := range comments {
		bodies = append(bodies, c.QuotedText, c.Body)
	}
	idx := Extract(note.WorkspaceID, note.ID, note.Title, note.Content, bodies)
	_, err = ix.db.ReplaceNoteSearchIndex(note.WorkspaceID, note.ID, idx, time.Now().UTC().Format(time.RFC3339))
	return err
}
