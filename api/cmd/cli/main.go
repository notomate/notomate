package main

import (
	"bufio"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/notomate/notomate/internal/bootstrap"
	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/dbcopy"
	"github.com/notomate/notomate/internal/model"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

// Version is set at build time via ldflags
var Version = "dev"

func main() {
	log.Printf("Notomate CLI version: %s", Version)

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "reset-password":
		resetPassword()
	case "migrate-db":
		migrateDB(os.Args[2:])
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Notomate CLI - Command line tools for Notomate")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  cli <command>")
	fmt.Println()
	fmt.Println("Available commands:")
	fmt.Println("  reset-password    Reset user password interactively")
	fmt.Println("  migrate-db        Copy all data to a database of another type (e.g. sqlite3 to mysql)")
	fmt.Println("  help              Show this help message")
	fmt.Println()
}

func resetPassword() {
	fmt.Println("=== Notomate Password Reset Tool ===")
	fmt.Println()

	// Initialize config
	config.Init()

	// Initialize database
	db, err := bootstrap.NewDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	reader := bufio.NewReader(os.Stdin)

	// Step 1: Get username or email
	fmt.Print("Enter username or email: ")
	usernameOrEmail, err := reader.ReadString('\n')
	if err != nil {
		log.Fatalf("Error reading input: %v", err)
	}
	usernameOrEmail = strings.TrimSpace(usernameOrEmail)

	if usernameOrEmail == "" {
		log.Fatal("Username or email cannot be empty")
	}

	// Find user
	users, err := db.FindUsers(model.UserFilter{NameOrEmail: usernameOrEmail})
	if err != nil {
		log.Fatalf("Error finding user: %v", err)
	}

	if len(users) == 0 {
		log.Fatalf("User not found: %s", usernameOrEmail)
	}

	user := users[0]
	fmt.Printf("Found user: %s (%s)\n", user.Name, user.Email)
	fmt.Println()

	// Step 2: Get new password
	fmt.Print("Enter new password: ")
	passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
	if err != nil {
		log.Fatalf("Error reading password: %v", err)
	}
	fmt.Println() // New line after password input

	password := string(passwordBytes)
	if len(password) < 6 {
		log.Fatal("Password must be at least 6 characters long")
	}

	// Step 3: Confirm password
	fmt.Print("Confirm new password: ")
	confirmPasswordBytes, err := term.ReadPassword(int(syscall.Stdin))
	if err != nil {
		log.Fatalf("Error reading password confirmation: %v", err)
	}
	fmt.Println() // New line after password input

	confirmPassword := string(confirmPasswordBytes)

	if password != confirmPassword {
		log.Fatal("Passwords do not match")
	}

	// Step 4: Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Step 5: Update user
	user.PasswordHash = string(hashedPassword)
	user.UpdatedBy = user.ID
	user.UpdatedAt = time.Now().UTC().String()

	err = db.UpdateUser(user)
	if err != nil {
		log.Fatalf("Failed to update user: %v", err)
	}

	fmt.Println()
	fmt.Printf("✓ Password successfully reset for user: %s\n", user.Name)
}

func migrateDB(args []string) {
	config.Init()

	fs := flag.NewFlagSet("migrate-db", flag.ExitOnError)
	fromDriver := fs.String("from-driver", config.C.GetString(config.DB_DRIVER), "source driver: sqlite3, postgres or mysql (default: DB_DRIVER)")
	fromDSN := fs.String("from-dsn", config.C.GetString(config.DB_DSN), "source DSN (default: DB_DSN)")
	toDriver := fs.String("to-driver", "", "target driver: sqlite3, postgres or mysql")
	toDSN := fs.String("to-dsn", "", "target DSN; the database must exist and hold no data")
	fs.Usage = func() {
		fmt.Println("Usage: cli migrate-db --to-driver <driver> --to-dsn <dsn> [--from-driver <driver> --from-dsn <dsn>]")
		fmt.Println()
		fmt.Println("Copies every row from the source database into the target, after applying")
		fmt.Println("the migrations to the target. Stop Notomate first so nothing is written")
		fmt.Println("to the source during the copy.")
		fmt.Println()
		fmt.Println("Example:")
		fmt.Println("  cli migrate-db --from-driver sqlite3 --from-dsn bin/notomate.db \\")
		fmt.Println("    --to-driver mysql --to-dsn 'notomate:notomate_password@tcp(localhost:3306)/notomate?charset=utf8mb4'")
		fmt.Println()
		fs.PrintDefaults()
	}
	fs.Parse(args)

	if *toDriver == "" || *toDSN == "" || *fromDriver == "" || *fromDSN == "" {
		fs.Usage()
		os.Exit(1)
	}

	fmt.Printf("Copying %s database into %s database...\n", *fromDriver, *toDriver)
	err := dbcopy.Copy(
		dbcopy.Endpoint{Driver: *fromDriver, DSN: *fromDSN},
		dbcopy.Endpoint{Driver: *toDriver, DSN: *toDSN},
		os.Stdout,
	)
	if err != nil {
		log.Fatalf("Database copy failed, nothing was written to the target: %v", err)
	}

	fmt.Println()
	fmt.Println("✓ Database copied. Point DB_DRIVER and DB_DSN at the target to use it.")
}
