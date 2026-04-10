package watcher

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/fsnotify/fsnotify"
	"github.com/ai-sessions/ai-sessions/internal/adapters"
	"github.com/ai-sessions/ai-sessions/internal/store"
	"github.com/ai-sessions/ai-sessions/internal/ws"
)

type Watcher struct {
	adapter adapters.Adapter
	store   *store.Store
	hub     *ws.Hub
}

func New(adapter adapters.Adapter, store *store.Store, hub *ws.Hub) *Watcher {
	return &Watcher{adapter: adapter, store: store, hub: hub}
}

func (w *Watcher) Start() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	watchDir := filepath.Join(home, ".claude", "projects")

	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	_ = filepath.Walk(watchDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || !info.IsDir() {
			return nil
		}
		return fw.Add(path)
	})

	go func() {
		defer fw.Close()
		for {
			select {
			case event, ok := <-fw.Events:
				if !ok {
					return
				}
				if !strings.HasSuffix(event.Name, ".jsonl") {
					continue
				}
				if event.Op&(fsnotify.Write|fsnotify.Create) == 0 {
					continue
				}
				w.handleChange(event.Name)
			case err, ok := <-fw.Errors:
				if !ok {
					return
				}
				log.Printf("watcher error: %v", err)
			}
		}
	}()

	return nil
}

func (w *Watcher) handleChange(path string) {
	sess, err := w.adapter.Parse(path)
	if err != nil {
		log.Printf("parse error for %s: %v", path, err)
		return
	}
	w.store.Upsert(sess)
	w.hub.BroadcastEvent("session_updated", map[string]any{
		"session_id":   sess.ID,
		"input_tokens": sess.TotalUsage.InputTokens,
		"project_dir":  sess.ProjectDir,
	})
	log.Printf("session updated: %s (%d input tokens)", sess.ID, sess.TotalUsage.InputTokens)
}
