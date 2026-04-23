package watcher

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/ai-sessions/ai-sessions/internal/adapters"
	"github.com/ai-sessions/ai-sessions/internal/store"
	"github.com/ai-sessions/ai-sessions/internal/ws"
)

// Target pairs a directory to watch with the adapter responsible for parsing files in that directory.
// FileExts controls which file extensions trigger a re-parse (e.g. ".jsonl", ".vscdb").
// If FileExts is empty, ".jsonl" is used as the default.
type Target struct {
	Dir      string
	Adapter  adapters.Adapter
	FileExts []string // extensions to watch, e.g. []string{".jsonl"} or []string{".vscdb"}
}

func (t Target) matches(name string) bool {
	exts := t.FileExts
	if len(exts) == 0 {
		exts = []string{".jsonl"}
	}
	for _, ext := range exts {
		if strings.HasSuffix(name, ext) {
			return true
		}
	}
	return false
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
		w.addDirRecursive(fw, t.Dir)
	}

	// debounce: coalesce rapid Write events for the same file into one parse
	const debounceDelay = 300 * time.Millisecond
	type pending struct {
		timer   *time.Timer
		path    string
	}
	var mu sync.Mutex
	timers := make(map[string]*time.Timer)

	schedule := func(path string) {
		mu.Lock()
		defer mu.Unlock()
		if t, ok := timers[path]; ok {
			t.Reset(debounceDelay)
			return
		}
		timers[path] = time.AfterFunc(debounceDelay, func() {
			mu.Lock()
			delete(timers, path)
			mu.Unlock()
			w.handleChange(path)
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
				// Dynamically register new directories so new project folders are watched immediately.
				if event.Op&fsnotify.Create != 0 {
					if info, err := os.Stat(event.Name); err == nil && info.IsDir() {
						w.addDirRecursive(fw, event.Name)
						continue
					}
				}
				if event.Op&(fsnotify.Write|fsnotify.Create) == 0 {
					continue
				}
				// Find the adapter whose target dir covers this file.
				adapter := w.adapterFor(event.Name)
				if adapter == nil {
					continue
				}
				// Check the file extension matches what this target expects.
				target := w.targetFor(event.Name)
				if target == nil || !target.matches(event.Name) {
					continue
				}
				schedule(event.Name)
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

// addDirRecursive walks path and registers every subdirectory with fw.
func (w *Watcher) addDirRecursive(fw *fsnotify.Watcher, root string) {
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || !info.IsDir() {
			return nil
		}
		if err := fw.Add(path); err != nil {
			log.Printf("watcher: failed to watch %s: %v", path, err)
		}
		return nil
	})
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
	if sess == nil {
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

// targetFor returns the Target whose watch directory contains the given file path.
func (w *Watcher) targetFor(path string) *Target {
	for i := range w.targets {
		if strings.HasPrefix(path, w.targets[i].Dir) {
			return &w.targets[i]
		}
	}
	return nil
}

// adapterFor returns the adapter whose watch directory contains the given file path.
func (w *Watcher) adapterFor(path string) adapters.Adapter {
	if t := w.targetFor(path); t != nil {
		return t.Adapter
	}
	return nil
}

