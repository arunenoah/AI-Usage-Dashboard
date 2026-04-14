package adapters

import "github.com/ai-sessions/ai-sessions/internal/models"

// Adapter reads sessions from an AI tool's local storage
type Adapter interface {
	// Name returns the tool name (e.g. "claude-code")
	Name() string
	// Detect returns all session file paths found under homedir
	Detect(homedir string) []string
	// Parse reads one session file and returns a parsed Session
	Parse(path string) (*models.Session, error)
}

// MultiSessionAdapter can return multiple sessions from a single path (e.g. a database).
type MultiSessionAdapter interface {
	Adapter
	// ParseAll reads all sessions from a single path (e.g. a SQLite database).
	ParseAll(path string) ([]*models.Session, error)
}
