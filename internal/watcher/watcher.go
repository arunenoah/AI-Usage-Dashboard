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

// Target pairs a directory to watch with the adapter responsible for parsing files in that directory.
type Target struct {
	Dir     string
	Adapter adapters.Adapter
}

type Watcher struct {
	targets []Target
	store   *store.Store
	hub     *ws.Hub
}

// New creates a Watcher for one or more adapter targets.
// Each Target specifies the root directory to watch and the adapter that can parse files within it.
func New(store *store.Store, hub *ws.Hub, targets ...Target) *Watcher {
	return &Watcher{targets: targets, store: store, hub: hub}
}

func (w *Watcher) Start() error {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	for _, t := range w.targets {
		if t.Dir == "" {
			continue
		}
		_ = filepath.Walk(t.Dir, func(path string, info os.FileInfo, err error) error {
			if err != nil || !info.IsDir() {
				return nil
			}
			return fw.Add(path)
		})
	}

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

// handleChange finds the right adapter for the changed file and re-parses it.
func (w *Watcher) handleChange(path string) {
	adapter := w.adapterFor(path)
	if adapter == nil {
		return
	}
	sess, err := adapter.Parse(path)
	if err != nil {
		log.Printf("parse error for %s: %v", path, err)
		return
	}
	w.store.Upsert(sess)
	w.hub.BroadcastEvent("session_updated", map[string]any{
		"session_id":   sess.ID,
		"input_tokens": sess.TotalUsage.InputTokens,
		"project_dir":  sess.ProjectDir,
		"source":       sess.Source,
	})
	log.Printf("session updated: %s [%s] (%d input tokens)", sess.ID, sess.Source, sess.TotalUsage.InputTokens)
}

// adapterFor returns the adapter whose watch directory contains the given file path.
func (w *Watcher) adapterFor(path string) adapters.Adapter {
	for _, t := range w.targets {
		if strings.HasPrefix(path, t.Dir) {
			return t.Adapter
		}
	}
	return nil
}

