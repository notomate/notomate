package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/notomate/notomate/internal/bootstrap"
	"github.com/notomate/notomate/internal/config"
	grpcserver "github.com/notomate/notomate/internal/grpc"
	"github.com/notomate/notomate/internal/server"
	"github.com/notomate/notomate/internal/workflow"
)

// Version is set at build time via ldflags
var Version = "dev"

func main() {
	log.Printf("Starting Notomate Web Server version: %s", Version)

	config.Init()

	if err := bootstrap.RunMigration(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	db, err := bootstrap.NewDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	storage, err := bootstrap.NewStorage()
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	engine := workflow.NewEngine(db)
	engine.Start()

	e, err := server.New(db, storage, engine)
	if err != nil {
		log.Fatalf("Failed to setup server: %v", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	grpcPort := config.C.GetString(config.GRPC_PORT)
	go grpcserver.Start(db, grpcPort, engine)

	// Start server in a goroutine
	go func() {
		log.Printf("Starting server on port %s", port)
		if err := e.Start(":" + port); err != nil {
			e.Logger.Fatal(err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	engine.Stop()

	// Gracefully shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		e.Logger.Fatal(err)
	}

	log.Println("Server stopped")
}
