package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/ai-sessions/ai-sessions/internal/adapters/claudecode"
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

	adapter := &claudecode.Adapter{}
	sessionStore := store.New()
	hub := ws.NewHub()

	if err := sessionStore.LoadAll(adapter); err != nil {
		log.Printf("initial load warning: %v", err)
	}
	log.Printf("loaded %d sessions", len(sessionStore.Sessions()))

	w := watcher.New(adapter, sessionStore, hub)
	if err := w.Start(); err != nil {
		log.Printf("watcher warning: %v", err)
	}

	mux := http.NewServeMux()
	h := &api.Handler{Store: sessionStore}
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
