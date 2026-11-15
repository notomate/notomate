// Command indexer keeps the note search index current. It runs as its own
// container next to the api: the api flags changed notes, and this process
// polls for them and rebuilds their index, so indexing load or a crash here
// never affects the api.
package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/notomate/notomate/internal/bootstrap"
	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/search"
)

// Version is set at build time via ldflags
var Version = "dev"

func main() {
	log.Printf("Starting Notomate search indexer version: %s", Version)

	config.Init()

	// The api owns the schema and runs the migrations; until it has, the
	// indexer's queries fail and are retried on every scan.
	db, err := bootstrap.NewDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	ix := search.NewIndexer(db, search.Options{
		Workers:      config.C.GetInt(config.SEARCH_WORKERS),
		ScanInterval: time.Duration(config.C.GetInt(config.SEARCH_SCAN_INTERVAL_SECONDS)) * time.Second,
		BatchSize:    config.C.GetInt(config.SEARCH_BATCH_SIZE),
	})
	ix.Run(ctx)

	log.Println("Search indexer stopped")
}
