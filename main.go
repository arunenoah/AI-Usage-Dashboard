package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"

	"github.com/ai-sessions/ai-sessions/internal/adapters/claudecode"
	"github.com/ai-sessions/ai-sessions/internal/adapters/copilot"
	"github.com/ai-sessions/ai-sessions/internal/adapters/opencode"
	"github.com/ai-sessions/ai-sessions/internal/adapters/windsurf"
	"github.com/ai-sessions/ai-sessions/internal/api"
	"github.com/ai-sessions/ai-sessions/internal/store"
	"github.com/ai-sessions/ai-sessions/internal/watcher"
	"github.com/ai-sessions/ai-sessions/internal/ws"
)

//go:embed all:web/dist
var webDist embed.FS

func main() {
	port := "8765"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	claudeAdapter := &claudecode.Adapter{}
	copilotAdapter := &copilot.Adapter{}
	opencodeAdapter := &opencode.Adapter{}
	windsurfAdapter := &windsurf.Adapter{}
	sessionStore := store.New()
	hub := ws.NewHub()

	if err := sessionStore.LoadAll(claudeAdapter, copilotAdapter, opencodeAdapter, windsurfAdapter); err != nil {
		log.Printf("initial load warning: %v", err)
	}
	home, _ := os.UserHomeDir()
	log.Printf("loaded %d sessions total", len(sessionStore.Sessions()))
	log.Printf("  claude-code:    %d sessions", len(sessionStore.SessionsBySource("claude-code")))
	log.Printf("  github-copilot: %d sessions", len(sessionStore.SessionsBySource("github-copilot")))
	log.Printf("  opencode:       %d sessions", len(sessionStore.SessionsBySource("opencode")))
	log.Printf("  windsurf:       %d sessions", len(sessionStore.SessionsBySource("windsurf")))

	// Determine watch directories
	claudeWatchDir := filepath.Join(home, ".claude", "projects")
	copilotWatchDir := vsCodeWorkspaceStorageDir(home)
	windsurfWatchDir := windsurf.WindsurfWatchDir(home)
	opencodeWatchDir := filepath.Join(home, ".local", "share", "opencode")

	w := watcher.New(sessionStore, hub,
		watcher.Target{Dir: claudeWatchDir, Adapter: claudeAdapter},
		watcher.Target{Dir: copilotWatchDir, Adapter: copilotAdapter},
		watcher.Target{Dir: windsurfWatchDir, Adapter: windsurfAdapter, FileExts: []string{".vscdb"}},
		watcher.Target{Dir: opencodeWatchDir, Adapter: opencodeAdapter, FileExts: []string{".db"}},
	)
	if err := w.Start(); err != nil {
		log.Printf("watcher warning: %v", err)
	}

	mux := http.NewServeMux()
	h := &api.Handler{
		Store:          sessionStore,
		Adapter:        claudeAdapter,
		CopilotAdapter: copilotAdapter,
	}
	h.Register(mux)
	mux.HandleFunc("/ws", hub.ServeWS)

	distFS, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		log.Fatalf("embed error: %v", err)
	}
	mux.Handle("/", http.FileServer(http.FS(distFS)))

	fmt.Printf("ai-sessions running -> http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

// vsCodeWorkspaceStorageDir returns the VS Code workspaceStorage directory for the current OS.
func vsCodeWorkspaceStorageDir(home string) string {
	switch runtime.GOOS {
	case "windows":
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			appdata = filepath.Join(home, "AppData", "Roaming")
		}
		return filepath.Join(appdata, "Code", "User", "workspaceStorage")
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "Code", "User", "workspaceStorage")
	default:
		configDir := os.Getenv("XDG_CONFIG_HOME")
		if configDir == "" {
			configDir = filepath.Join(home, ".config")
		}
		return filepath.Join(configDir, "Code", "User", "workspaceStorage")
	}
}

