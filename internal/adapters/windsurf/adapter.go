package windsurf

import (
	"database/sql"
	"encoding/json"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/adapters"
	"github.com/ai-sessions/ai-sessions/internal/models"

	_ "github.com/mattn/go-sqlite3"
)

// Adapter implements adapters.Adapter for Windsurf (Codeium) session data.
// Windsurf stores workspace data at:
//
//	macOS:   ~/Library/Application Support/Windsurf/User/workspaceStorage/<hash>/
//	Linux:   ~/.config/Windsurf/User/workspaceStorage/<hash>/
//	Windows: %APPDATA%\Windsurf\User\workspaceStorage\<hash>\
//
// Each workspace has a state.vscdb (SQLite) and workspace.json.
// File edit history is stored under ~/Library/Application Support/Windsurf/User/History/
//
// Note: Windsurf stores actual conversation content server-side (Codeium servers),
// so we can only extract session metadata (workspace, file counts, timestamps).
type Adapter struct{}

var _ adapters.Adapter = (*Adapter)(nil)

func (a *Adapter) Name() string { return "windsurf" }

// windsurfUserDirs returns the Windsurf User config directories for the current OS.
func windsurfUserDirs(homedir string) []string {
	switch runtime.GOOS {
	case "windows":
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			appdata = filepath.Join(homedir, "AppData", "Roaming")
		}
		return []string{
			filepath.Join(appdata, "Windsurf", "User"),
		}
	case "darwin":
		return []string{
			filepath.Join(homedir, "Library", "Application Support", "Windsurf", "User"),
		}
	default:
		configDir := os.Getenv("XDG_CONFIG_HOME")
		if configDir == "" {
			configDir = filepath.Join(homedir, ".config")
		}
		return []string{
			filepath.Join(configDir, "Windsurf", "User"),
		}
	}
}

// Detect finds all workspace state.vscdb files in Windsurf's workspaceStorage.
func (a *Adapter) Detect(homedir string) []string {
	var paths []string
	for _, userDir := range windsurfUserDirs(homedir) {
		wsRoot := filepath.Join(userDir, "workspaceStorage")
		entries, err := os.ReadDir(wsRoot)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			dbPath := filepath.Join(wsRoot, e.Name(), "state.vscdb")
			if _, err := os.Stat(dbPath); err == nil {
				paths = append(paths, dbPath)
			}
		}
	}
	return paths
}

// workspaceJSON is the structure of workspace.json
type workspaceJSON struct {
	Folder string `json:"folder"`
}

// Parse reads a workspace state.vscdb and extracts session metadata.
func (a *Adapter) Parse(dbPath string) (*models.Session, error) {
	wsDir := filepath.Dir(dbPath)

	// Read workspace.json for the project directory
	projectDir := ""
	wsJSONPath := filepath.Join(wsDir, "workspace.json")
	if data, err := os.ReadFile(wsJSONPath); err == nil {
		var ws workspaceJSON
		if json.Unmarshal(data, &ws) == nil && ws.Folder != "" {
			if u, err := url.Parse(ws.Folder); err == nil {
				projectDir = u.Path
			} else {
				projectDir = ws.Folder
			}
		}
	}
	if projectDir == "" {
		return nil, nil // skip workspaces without a project
	}

	// Open the SQLite database
	db, err := sql.Open("sqlite3", dbPath+"?mode=ro")
	if err != nil {
		return nil, err
	}
	defer db.Close()

	// Try to read session metadata from interactive.sessions or cascade state
	var sessionCount int
	var lastActivity time.Time

	// Check for cascade state data
	var cascadeState string
	db.QueryRow(`SELECT value FROM ItemTable WHERE key LIKE '%cascade%state%' LIMIT 1`).Scan(&cascadeState)

	// Get the workspace hash as session ID
	wsHash := filepath.Base(wsDir)

	// Get file modification time as a proxy for last activity
	info, err := os.Stat(dbPath)
	if err != nil {
		return nil, err
	}
	lastActivity = info.ModTime()

	// Count interactive sessions
	var sessData string
	db.QueryRow(`SELECT value FROM ItemTable WHERE key='interactive.sessions'`).Scan(&sessData)
	if sessData != "" && sessData != "[]" {
		// Parse the JSON array to count sessions
		var sessions []interface{}
		if json.Unmarshal([]byte(sessData), &sessions) == nil {
			sessionCount = len(sessions)
		}
	}

	// Get the creation time from the workspace folder
	wsInfo, _ := os.Stat(wsDir)
	startTime := wsInfo.ModTime()
	if wsInfo != nil {
		startTime = wsInfo.ModTime()
	}

	// Count files in the History directory that might relate to this workspace
	historyCount := 0
	for _, userDir := range windsurfUserDirs(os.Getenv("HOME")) {
		histDir := filepath.Join(userDir, "History")
		if entries, err := os.ReadDir(histDir); err == nil {
			for _, e := range entries {
				if e.IsDir() {
					historyCount++
				}
			}
		}
	}

	// Extract the project name for the title
	projectName := filepath.Base(projectDir)
	if projectName == "." || projectName == "/" {
		projectName = "Unknown"
	}

	sess := &models.Session{
		ID:          "ws-" + wsHash,
		FilePath:    dbPath,
		ProjectDir:  projectDir,
		Source:      "windsurf",
		Model:       "cascade",
		StartTime:   startTime,
		EndTime:     lastActivity,
		FirstPrompt: "Windsurf workspace: " + projectName,
		UserTurns:   sessionCount,
		AssistTurns: sessionCount,
		ToolCounts:  make(map[string]int),
	}

	// Windsurf doesn't store token data locally, so we leave usage at zero
	// but set a flag via tool counts to indicate it's metadata-only
	if sessionCount > 0 {
		sess.ToolCounts["Cascade"] = sessionCount
	}

	return sess, nil
}

// ParseTurnsFull is not supported for Windsurf (content is server-side).
func (a *Adapter) ParseTurnsFull(path string) ([]models.TurnEntry, error) {
	return nil, nil
}

// windsurfWatchDir returns the root directory to watch for Windsurf.
func WindsurfWatchDir(homedir string) string {
	dirs := windsurfUserDirs(homedir)
	if len(dirs) > 0 {
		return filepath.Join(dirs[0], "workspaceStorage")
	}
	return ""
}

// CountFileHistory counts the number of file edit history entries.
func CountFileHistory(homedir string) int {
	count := 0
	for _, userDir := range windsurfUserDirs(homedir) {
		histDir := filepath.Join(userDir, "History")
		if entries, err := os.ReadDir(histDir); err == nil {
			for _, e := range entries {
				if e.IsDir() {
					count++
				}
			}
		}
	}
	return count
}

// workspaceProject extracts the project name from a workspace.json file path.
func workspaceProject(wsDir string) string {
	data, err := os.ReadFile(filepath.Join(wsDir, "workspace.json"))
	if err != nil {
		return ""
	}
	var ws workspaceJSON
	if json.Unmarshal(data, &ws) != nil || ws.Folder == "" {
		return ""
	}
	if u, err := url.Parse(ws.Folder); err == nil {
		parts := strings.Split(u.Path, "/")
		for i := len(parts) - 1; i >= 0; i-- {
			if parts[i] != "" {
				return parts[i]
			}
		}
	}
	return ws.Folder
}
