package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/notomate/notomate/internal/bootstrap"
	"github.com/notomate/notomate/internal/config"
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
