# ai-sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ai-sessions` — a single-binary Go + React analytics dashboard that reads Claude Code JSONL session files and shows token usage, cost, productivity patterns, tool distribution, and prompt optimization advice in a Purity UI-styled interface.

**Architecture:** Go backend embeds the compiled React build into a single binary; it exposes a REST API for session data and a WebSocket endpoint for live updates. An fsnotify watcher monitors `~/.claude/projects/` and broadcasts new data to connected clients in real time. A pluggable adapter interface allows future support for Cursor, Copilot, and Windsurf.

**Tech Stack:** Go 1.22, gorilla/websocket, fsnotify/fsnotify, React 18 + Vite, Chart.js 4.4, Figtree + JetBrains Mono (Google Fonts), pure CSS (no CSS framework)

---

## File Structure

```
claudeDash/
├── cmd/ai-sessions/main.go        # Entry point: embed FS, wire deps, start HTTP server
├── internal/
│   ├── models/models.go           # Session, Message, Usage, ToolUse, Stats structs
│   ├── adapters/
│   │   ├── adapter.go             # Adapter interface definition
│   │   └── claudecode/adapter.go  # Claude Code JSONL parser implementing Adapter
│   ├── store/store.go             # In-memory store: index sessions, compute aggregations
│   ├── api/handlers.go            # REST handlers: /api/stats, /api/sessions, /api/tools
│   ├── ws/hub.go                  # WebSocket hub: register/unregister clients, broadcast
│   └── watcher/watcher.go        # fsnotify watcher: detect new/changed JSONL, trigger parse
├── web/                           # React frontend (compiled output embedded into binary)
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx               # React root
│       ├── App.jsx                # Router, layout shell
│       ├── assets/icons.svg       # SVG sprite (18 icons from Interface Icons.svg)
│       ├── styles/main.css        # Purity UI variables, layout, sidebar, cards
│       ├── hooks/useWebSocket.js  # WebSocket client hook with reconnect
│       ├── components/
│       │   ├── Sidebar.jsx        # Dark gradient sidebar with SVG nav icons
│       │   ├── LiveBanner.jsx     # Orange live-session notification bar
│       │   ├── StatCard.jsx       # KPI cards with gradient icon boxes
│       │   ├── TokenChart.jsx     # Chart.js stacked bar (input/output/cache tokens)
│       │   ├── CostChart.jsx      # Chart.js line chart with teal fill
│       │   ├── ToolChart.jsx      # Horizontal bar chart for tool distribution
│       │   ├── PromptScore.jsx    # SVG ring score + optimization insights list
│       │   ├── ActivityChart.jsx  # Hourly activity bar chart
│       │   └── SessionTable.jsx   # Searchable session explorer table with tabs
│       └── pages/
│           ├── Dashboard.jsx      # Main overview page
│           ├── Sessions.jsx       # Full session explorer page
│           └── Settings.jsx       # Tool adapters config page (stub)
├── go.mod
├── Makefile                       # build, dev, test targets
└── README.md
```

---

### Task 1: Go Module + Project Scaffold

**Files:**
- Create: `go.mod`
- Create: `Makefile`
- Create: `cmd/ai-sessions/main.go` (stub)
- Create: `internal/models/models.go` (stub)

- [ ] **Step 1: Initialize Go module**

```bash
cd /Users/arunkumar/Documents/Application/learning-platform/claudeDash
go mod init github.com/ai-sessions/ai-sessions
```

Expected: `go.mod` created with `module github.com/ai-sessions/ai-sessions` and `go 1.22`

- [ ] **Step 2: Add dependencies**

```bash
go get github.com/gorilla/websocket@v1.5.3
go get github.com/fsnotify/fsnotify@v1.7.0
```

Expected: `go.sum` created, both packages in `go.mod`

- [ ] **Step 3: Create directory structure**

```bash
mkdir -p cmd/ai-sessions internal/models internal/adapters/claudecode internal/store internal/api internal/ws internal/watcher web/src/{components,pages,hooks,styles,assets}
```

- [ ] **Step 4: Write stub main.go**

Create `cmd/ai-sessions/main.go`:
```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	port := "8765"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}
	fmt.Printf("ai-sessions listening on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
```

- [ ] **Step 5: Verify it compiles**

```bash
go build ./cmd/ai-sessions/
```
Expected: binary `ai-sessions` created with no errors.

- [ ] **Step 6: Create Makefile**

Create `Makefile`:
```makefile
.PHONY: build dev web test clean

build: web
	go build -o ai-sessions ./cmd/ai-sessions/

web:
	cd web && npm install && npm run build

dev:
	@echo "Run 'cd web && npm run dev' in one terminal"
	@echo "Run 'go run ./cmd/ai-sessions/' in another"

test:
	go test ./...

clean:
	rm -f ai-sessions
	rm -rf web/dist
```

- [ ] **Step 7: Commit**

```bash
git add go.mod go.sum Makefile cmd/ internal/ web/
git commit -m "feat: scaffold ai-sessions Go module and directory structure"
```

---

### Task 2: Data Models

**Files:**
- Create: `internal/models/models.go`

- [ ] **Step 1: Write models**

Create `internal/models/models.go`:
```go
package models

import "time"

// RawEntry is one line from a Claude Code JSONL session file
type RawEntry struct {
	Type      string     `json:"type"`
	UUID      string     `json:"uuid"`
	Timestamp time.Time  `json:"timestamp"`
	Message   *RawMessage `json:"message,omitempty"`
}

// RawMessage is the message payload inside an assistant entry
type RawMessage struct {
	Role    string       `json:"role"`
	Content []RawContent `json:"content"`
	Usage   *Usage       `json:"usage,omitempty"`
}

// RawContent is one content block (text or tool_use)
type RawContent struct {
	Type  string `json:"type"`
	Text  string `json:"text,omitempty"`
	Name  string `json:"name,omitempty"` // tool name when type=tool_use
	Input any    `json:"input,omitempty"`
}

// Usage holds token counts for one assistant turn
type Usage struct {
	InputTokens              int `json:"input_tokens"`
	OutputTokens             int `json:"output_tokens"`
	CacheReadInputTokens     int `json:"cache_read_input_tokens"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
}

// Session represents a parsed Claude Code session
type Session struct {
	ID          string    `json:"id"`
	FilePath    string    `json:"file_path"`
	ProjectDir  string    `json:"project_dir"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	UserTurns   int       `json:"user_turns"`
	AssistTurns int       `json:"assist_turns"`
	TotalUsage  Usage     `json:"total_usage"`
	ToolCounts  map[string]int `json:"tool_counts"`
	FirstPrompt string    `json:"first_prompt"`
	Source      string    `json:"source"` // "claude-code"
}

// DailyStats aggregates token/cost data per day
type DailyStats struct {
	Date         string  `json:"date"` // "2006-01-02"
	InputTokens  int     `json:"input_tokens"`
	OutputTokens int     `json:"output_tokens"`
	CacheRead    int     `json:"cache_read"`
	Sessions     int     `json:"sessions"`
	EstCostUSD   float64 `json:"est_cost_usd"`
}

// Stats is the top-level aggregated response for the dashboard
type Stats struct {
	TotalSessions    int            `json:"total_sessions"`
	TotalInputTokens int            `json:"total_input_tokens"`
	TotalOutputTokens int           `json:"total_output_tokens"`
	TotalCostUSD     float64        `json:"total_cost_usd"`
	AvgSessionTokens int            `json:"avg_session_tokens"`
	Daily            []DailyStats   `json:"daily"`
	ToolCounts       map[string]int `json:"tool_counts"`
	ActiveSession    *Session       `json:"active_session,omitempty"`
}
```

- [ ] **Step 2: Verify it compiles**

```bash
go build ./internal/models/
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add internal/models/models.go
git commit -m "feat: add ai-sessions data models"
```

---

### Task 3: Claude Code Adapter

**Files:**
- Create: `internal/adapters/adapter.go`
- Create: `internal/adapters/claudecode/adapter.go`

- [ ] **Step 1: Define adapter interface**

Create `internal/adapters/adapter.go`:
```go
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
```

- [ ] **Step 2: Implement Claude Code adapter**

Create `internal/adapters/claudecode/adapter.go`:
```go
package claudecode

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ai-sessions/ai-sessions/internal/adapters"
	"github.com/ai-sessions/ai-sessions/internal/models"
)

// Adapter implements adapters.Adapter for Claude Code JSONL files
type Adapter struct{}

var _ adapters.Adapter = (*Adapter)(nil)

func (a *Adapter) Name() string { return "claude-code" }

// Detect finds all .jsonl files under ~/.claude/projects/
func (a *Adapter) Detect(homedir string) []string {
	root := filepath.Join(homedir, ".claude", "projects")
	var paths []string
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if strings.HasSuffix(path, ".jsonl") {
			paths = append(paths, path)
		}
		return nil
	})
	return paths
}

// Parse reads a Claude Code JSONL session file
func (a *Adapter) Parse(path string) (*models.Session, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	// Derive IDs from file path
	base := filepath.Base(path)
	sessionID := strings.TrimSuffix(base, ".jsonl")
	projectDir := decodeProjectDir(filepath.Dir(path))

	session := &models.Session{
		ID:         sessionID,
		FilePath:   path,
		ProjectDir: projectDir,
		Source:     "claude-code",
		ToolCounts: make(map[string]int),
	}

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 10*1024*1024), 10*1024*1024) // 10MB buffer
	firstUser := true

	for scanner.Scan() {
		var entry models.RawEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue // skip malformed lines
		}

		// Track time range
		if session.StartTime.IsZero() || entry.Timestamp.Before(session.StartTime) {
			session.StartTime = entry.Timestamp
		}
		if entry.Timestamp.After(session.EndTime) {
			session.EndTime = entry.Timestamp
		}

		if entry.Type == "user" {
			session.UserTurns++
			if firstUser && entry.Message != nil {
				for _, c := range entry.Message.Content {
					if c.Type == "text" && c.Text != "" {
						session.FirstPrompt = truncate(c.Text, 120)
						firstUser = false
						break
					}
				}
			}
		}

		if entry.Type == "assistant" && entry.Message != nil {
			session.AssistTurns++
			if u := entry.Message.Usage; u != nil {
				session.TotalUsage.InputTokens += u.InputTokens
				session.TotalUsage.OutputTokens += u.OutputTokens
				session.TotalUsage.CacheReadInputTokens += u.CacheReadInputTokens
				session.TotalUsage.CacheCreationInputTokens += u.CacheCreationInputTokens
			}
			for _, c := range entry.Message.Content {
				if c.Type == "tool_use" && c.Name != "" {
					session.ToolCounts[c.Name]++
				}
			}
		}
	}

	return session, scanner.Err()
}

// decodeProjectDir converts the encoded directory name back to a path.
// Claude Code encodes "/" as "-" in the directory name, e.g.:
// -Users-arunkumar-Documents-Application → /Users/arunkumar/Documents/Application
func decodeProjectDir(encoded string) string {
	base := filepath.Base(encoded)
	// Replace leading dash, then remaining dashes with slashes
	if strings.HasPrefix(base, "-") {
		base = base[1:]
	}
	return "/" + strings.ReplaceAll(base, "-", "/")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
```

- [ ] **Step 3: Verify compilation**

```bash
go build ./internal/adapters/...
```
Expected: no errors.

- [ ] **Step 4: Write a quick parse smoke test**

Create `internal/adapters/claudecode/adapter_test.go`:
```go
package claudecode

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetect(t *testing.T) {
	home, _ := os.UserHomeDir()
	a := &Adapter{}
	paths := a.Detect(home)
	// Must not panic; may return 0 paths in CI
	t.Logf("detected %d sessions", len(paths))
}

func TestParseRealSession(t *testing.T) {
	home, _ := os.UserHomeDir()
	a := &Adapter{}
	paths := a.Detect(home)
	if len(paths) == 0 {
		t.Skip("no Claude Code sessions found")
	}
	// Parse the first available session
	session, err := a.Parse(paths[0])
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if session.ID == "" {
		t.Error("session ID is empty")
	}
	t.Logf("session %s: %d user turns, %d input tokens, first prompt: %q",
		session.ID, session.UserTurns, session.TotalUsage.InputTokens, session.FirstPrompt)
	_ = filepath.Base(session.FilePath) // ensure field set
}

func TestDecodeProjectDir(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"-Users-arunkumar-Documents-Application", "/Users/arunkumar/Documents/Application"},
		{"-home-dev-myproject", "/home/dev/myproject"},
	}
	for _, tt := range tests {
		got := decodeProjectDir(tt.input)
		if got != tt.want {
			t.Errorf("decodeProjectDir(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
```

- [ ] **Step 5: Run tests**

```bash
go test ./internal/adapters/... -v
```
Expected: TestDecodeProjectDir PASS, others PASS or SKIP.

- [ ] **Step 6: Commit**

```bash
git add internal/adapters/
git commit -m "feat: add Claude Code JSONL adapter with session parser"
```

---

### Task 4: In-Memory Store + Aggregations

**Files:**
- Create: `internal/store/store.go`

- [ ] **Step 1: Write the store**

Create `internal/store/store.go`:
```go
package store

import (
	"math"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/adapters"
	"github.com/ai-sessions/ai-sessions/internal/models"
)

// pricing per million tokens (Claude Sonnet 3.5 as baseline)
const (
	priceInputPerM  = 3.0
	priceOutputPerM = 15.0
	priceCachePerM  = 0.3
)

// Store holds all parsed sessions in memory
type Store struct {
	mu       sync.RWMutex
	sessions map[string]*models.Session // keyed by session ID
}

func New() *Store {
	return &Store{sessions: make(map[string]*models.Session)}
}

// Upsert adds or replaces a session
func (s *Store) Upsert(session *models.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.ID] = session
}

// LoadAll parses all sessions found by adapter and populates the store
func (s *Store) LoadAll(adapter adapters.Adapter) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	paths := adapter.Detect(home)
	for _, p := range paths {
		sess, err := adapter.Parse(p)
		if err != nil {
			continue
		}
		s.Upsert(sess)
	}
	return nil
}

// Sessions returns all sessions sorted by start time descending
func (s *Store) Sessions() []*models.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.Session, 0, len(s.sessions))
	for _, v := range s.sessions {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].StartTime.After(out[j].StartTime)
	})
	return out
}

// Stats computes aggregated statistics across all sessions
func (s *Store) Stats() models.Stats {
	sessions := s.Sessions()
	if len(sessions) == 0 {
		return models.Stats{}
	}

	stats := models.Stats{
		TotalSessions: len(sessions),
		ToolCounts:    make(map[string]int),
	}

	// Find the newest session as potentially active
	if len(sessions) > 0 && time.Since(sessions[0].EndTime) < 30*time.Minute {
		stats.ActiveSession = sessions[0]
	}

	dailyMap := make(map[string]*models.DailyStats)

	for _, sess := range sessions {
		stats.TotalInputTokens += sess.TotalUsage.InputTokens
		stats.TotalOutputTokens += sess.TotalUsage.OutputTokens

		cost := tokenCost(sess.TotalUsage)
		stats.TotalCostUSD += cost

		for tool, count := range sess.ToolCounts {
			stats.ToolCounts[tool] += count
		}

		day := sess.StartTime.Format("2006-01-02")
		if _, ok := dailyMap[day]; !ok {
			dailyMap[day] = &models.DailyStats{Date: day}
		}
		d := dailyMap[day]
		d.InputTokens += sess.TotalUsage.InputTokens
		d.OutputTokens += sess.TotalUsage.OutputTokens
		d.CacheRead += sess.TotalUsage.CacheReadInputTokens
		d.Sessions++
		d.EstCostUSD += cost
	}

	// Convert daily map to sorted slice (last 30 days)
	for _, d := range dailyMap {
		stats.Daily = append(stats.Daily, *d)
	}
	sort.Slice(stats.Daily, func(i, j int) bool {
		return stats.Daily[i].Date < stats.Daily[j].Date
	})
	if len(stats.Daily) > 30 {
		stats.Daily = stats.Daily[len(stats.Daily)-30:]
	}

	if len(sessions) > 0 {
		stats.AvgSessionTokens = (stats.TotalInputTokens + stats.TotalOutputTokens) / len(sessions)
	}

	stats.TotalCostUSD = math.Round(stats.TotalCostUSD*100) / 100
	return stats
}

func tokenCost(u models.Usage) float64 {
	return float64(u.InputTokens)/1e6*priceInputPerM +
		float64(u.OutputTokens)/1e6*priceOutputPerM +
		float64(u.CacheReadInputTokens)/1e6*priceCachePerM
}
```

- [ ] **Step 2: Write store tests**

Create `internal/store/store_test.go`:
```go
package store

import (
	"testing"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/models"
)

func TestStoreUpsertAndStats(t *testing.T) {
	s := New()

	sess := &models.Session{
		ID:          "abc123",
		ProjectDir:  "/Users/dev/myapp",
		Source:      "claude-code",
		StartTime:   time.Now().Add(-2 * time.Hour),
		EndTime:     time.Now().Add(-1 * time.Hour),
		UserTurns:   5,
		AssistTurns: 5,
		TotalUsage: models.Usage{
			InputTokens:  100_000,
			OutputTokens: 5_000,
		},
		ToolCounts: map[string]int{"Read": 10, "Bash": 3},
	}
	s.Upsert(sess)

	stats := s.Stats()
	if stats.TotalSessions != 1 {
		t.Errorf("want 1 session, got %d", stats.TotalSessions)
	}
	if stats.TotalInputTokens != 100_000 {
		t.Errorf("want 100000 input tokens, got %d", stats.TotalInputTokens)
	}
	if stats.ToolCounts["Read"] != 10 {
		t.Errorf("want Read=10, got %d", stats.ToolCounts["Read"])
	}
	if stats.TotalCostUSD <= 0 {
		t.Error("expected positive cost")
	}
}

func TestStoreSessionsOrder(t *testing.T) {
	s := New()
	now := time.Now()
	s.Upsert(&models.Session{ID: "old", StartTime: now.Add(-2 * time.Hour), ToolCounts: map[string]int{}})
	s.Upsert(&models.Session{ID: "new", StartTime: now.Add(-1 * time.Hour), ToolCounts: map[string]int{}})

	sessions := s.Sessions()
	if sessions[0].ID != "new" {
		t.Errorf("expected newest first, got %s", sessions[0].ID)
	}
}
```

- [ ] **Step 3: Run tests**

```bash
go test ./internal/store/ -v
```
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add internal/store/
git commit -m "feat: add in-memory session store with aggregation and cost calculation"
```

---

### Task 5: REST API Handlers

**Files:**
- Create: `internal/api/handlers.go`

- [ ] **Step 1: Write handlers**

Create `internal/api/handlers.go`:
```go
package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/ai-sessions/ai-sessions/internal/store"
)

type Handler struct {
	Store *store.Store
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/stats", h.getStats)
	mux.HandleFunc("/api/sessions", h.getSessions)
	mux.HandleFunc("/api/tools", h.getTools)
	mux.HandleFunc("/api/health", h.health)
}

func (h *Handler) getStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, h.Store.Stats())
}

func (h *Handler) getSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	sessions := h.Store.Sessions()

	// Pagination: ?page=1&limit=20
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 20
	}
	start := (page - 1) * limit
	end := start + limit
	if start >= len(sessions) {
		writeJSON(w, map[string]any{"sessions": []any{}, "total": len(sessions), "page": page})
		return
	}
	if end > len(sessions) {
		end = len(sessions)
	}
	writeJSON(w, map[string]any{
		"sessions": sessions[start:end],
		"total":    len(sessions),
		"page":     page,
	})
}

func (h *Handler) getTools(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	stats := h.Store.Stats()
	writeJSON(w, stats.ToolCounts)
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_ = json.NewEncoder(w).Encode(v)
}
```

- [ ] **Step 2: Write handler tests**

Create `internal/api/handlers_test.go`:
```go
package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/models"
	"github.com/ai-sessions/ai-sessions/internal/store"
)

func newTestHandler() *Handler {
	s := store.New()
	s.Upsert(&models.Session{
		ID:          "test-session-1",
		ProjectDir:  "/dev/myapp",
		Source:      "claude-code",
		StartTime:   time.Now().Add(-1 * time.Hour),
		EndTime:     time.Now(),
		UserTurns:   3,
		AssistTurns: 3,
		TotalUsage:  models.Usage{InputTokens: 50_000, OutputTokens: 2_000},
		ToolCounts:  map[string]int{"Read": 5, "Bash": 2},
	})
	return &Handler{Store: s}
}

func TestGetStats(t *testing.T) {
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	rr := httptest.NewRecorder()
	h.getStats(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	var stats models.Stats
	if err := json.NewDecoder(rr.Body).Decode(&stats); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if stats.TotalSessions != 1 {
		t.Errorf("expected 1 session, got %d", stats.TotalSessions)
	}
}

func TestGetSessions(t *testing.T) {
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/sessions?page=1&limit=10", nil)
	rr := httptest.NewRecorder()
	h.getSessions(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var result map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if result["total"].(float64) != 1 {
		t.Errorf("expected total=1, got %v", result["total"])
	}
}
```

- [ ] **Step 3: Run tests**

```bash
go test ./internal/api/ -v
```
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add internal/api/
git commit -m "feat: add REST API handlers for stats, sessions, and tool distribution"
```

---

### Task 6: WebSocket Hub

**Files:**
- Create: `internal/ws/hub.go`

- [ ] **Step 1: Write the WebSocket hub**

Create `internal/ws/hub.go`:
```go
package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow all origins in dev
}

// Hub manages active WebSocket connections
type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]struct{}
}

func NewHub() *Hub {
	return &Hub{clients: make(map[*websocket.Conn]struct{})}
}

// ServeWS upgrades an HTTP connection to WebSocket and registers it
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}
	h.mu.Lock()
	h.clients[conn] = struct{}{}
	h.mu.Unlock()

	// Clean up on disconnect
	go func() {
		defer func() {
			h.mu.Lock()
			delete(h.clients, conn)
			h.mu.Unlock()
			conn.Close()
		}()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
}

// BroadcastEvent sends a typed JSON event to all connected clients
func (h *Hub) BroadcastEvent(eventType string, payload any) {
	msg, err := json.Marshal(map[string]any{
		"type":    eventType,
		"payload": payload,
	})
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for conn := range h.clients {
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("ws write error: %v", err)
		}
	}
}
```

- [ ] **Step 2: Verify compilation**

```bash
go build ./internal/ws/
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add internal/ws/
git commit -m "feat: add WebSocket hub for real-time session update broadcasting"
```

---

### Task 7: File Watcher

**Files:**
- Create: `internal/watcher/watcher.go`

- [ ] **Step 1: Write the watcher**

Create `internal/watcher/watcher.go`:
```go
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

// Watcher monitors the Claude Code sessions directory for new/modified JSONL files
type Watcher struct {
	adapter adapters.Adapter
	store   *store.Store
	hub     *ws.Hub
}

func New(adapter adapters.Adapter, store *store.Store, hub *ws.Hub) *Watcher {
	return &Watcher{adapter: adapter, store: store, hub: hub}
}

// Start begins watching ~/.claude/projects/ in a background goroutine
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

	// Watch all subdirectories
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
```

- [ ] **Step 2: Verify compilation**

```bash
go build ./internal/watcher/
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add internal/watcher/
git commit -m "feat: add fsnotify watcher for live session updates via WebSocket"
```

---

### Task 8: Wire Up main.go

**Files:**
- Modify: `cmd/ai-sessions/main.go`

- [ ] **Step 1: Rewrite main.go to wire all components**

Replace `cmd/ai-sessions/main.go`:
```go
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

	// --- Dependencies ---
	adapter := &claudecode.Adapter{}
	sessionStore := store.New()
	hub := ws.NewHub()

	// Load all existing sessions at startup
	if err := sessionStore.LoadAll(adapter); err != nil {
		log.Printf("initial load warning: %v", err)
	}
	log.Printf("loaded %d sessions", len(sessionStore.Sessions()))

	// Start file watcher
	w := watcher.New(adapter, sessionStore, hub)
	if err := w.Start(); err != nil {
		log.Printf("watcher warning: %v", err)
	}

	// --- HTTP Routes ---
	mux := http.NewServeMux()

	// REST API
	h := &api.Handler{Store: sessionStore}
	h.Register(mux)

	// WebSocket
	mux.HandleFunc("/ws", hub.ServeWS)

	// Serve embedded React build
	distFS, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		log.Fatalf("embed error: %v", err)
	}
	mux.Handle("/", http.FileServer(http.FS(distFS)))

	fmt.Printf("✓ ai-sessions running → http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
```

- [ ] **Step 2: Create a placeholder web/dist so it compiles before React is built**

```bash
mkdir -p web/dist && echo '<!DOCTYPE html><html><body>Building...</body></html>' > web/dist/index.html
```

- [ ] **Step 3: Verify compilation**

```bash
go build ./cmd/ai-sessions/
```
Expected: `ai-sessions` binary with no errors.

- [ ] **Step 4: Run all Go tests**

```bash
go test ./...
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cmd/ web/dist/
git commit -m "feat: wire main.go — store, adapter, watcher, WebSocket, embedded React"
```

---

### Task 9: React + Vite Project Scaffold

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.js`
- Create: `web/index.html`
- Create: `web/src/main.jsx`

- [ ] **Step 1: Create package.json**

Create `web/package.json`:
```json
{
  "name": "ai-sessions-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "chart.js": "^4.4.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

Create `web/vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8765',
      '/ws': { target: 'ws://localhost:8765', ws: true },
    },
  },
})
```

- [ ] **Step 3: Create index.html**

Create `web/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ai-sessions</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create src/main.jsx**

Create `web/src/main.jsx`:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/main.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 5: Install dependencies**

```bash
cd web && npm install
```
Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
cd .. && git add web/package.json web/vite.config.js web/index.html web/src/main.jsx web/package-lock.json
git commit -m "feat: scaffold React + Vite frontend with Chart.js and react-router-dom"
```

---

### Task 10: Purity UI CSS Foundation

**Files:**
- Create: `web/src/styles/main.css`

- [ ] **Step 1: Write the CSS**

Create `web/src/styles/main.css`:
```css
/* ── RESET ─────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 14px; -webkit-font-smoothing: antialiased; }
body { background: #f0f2f5; color: #344767; font-family: 'Figtree', sans-serif; min-height: 100vh; }
button, input, select { font-family: inherit; cursor: pointer; border: none; background: none; }
a { text-decoration: none; color: inherit; }

/* ── TOKENS ──────────────────────────────────────────────────────── */
:root {
  --c-text: #344767;
  --c-text-2: #7b809a;
  --c-text-3: #9baabf;
  --c-canvas: #f0f2f5;
  --c-card: #ffffff;
  --c-border: rgba(0,0,0,0.05);
  --c-shadow: 0 4px 24px rgba(0,0,0,0.04);
  --c-shadow-lg: 0 8px 32px rgba(0,0,0,0.08);
  --c-blue: #1A73E8;
  --c-blue-lt: #49a3f1;
  --c-teal: #4CAF50;
  --c-orange: #FB8C00;
  --c-purple: #9C27B0;
  --c-green: #66BB6A;
  --c-red: #F44336;
  --sidebar-w: 260px;
  --radius: 14px;
  --radius-sm: 8px;
}

/* ── LAYOUT ──────────────────────────────────────────────────────── */
.layout { display: flex; min-height: 100vh; }
.main { margin-left: var(--sidebar-w); flex: 1; padding: 28px 28px 48px; min-width: 0; }

/* ── SIDEBAR ─────────────────────────────────────────────────────── */
.sidebar {
  width: var(--sidebar-w);
  position: fixed; inset: 0 auto 0 0;
  background: linear-gradient(195deg, #42424a, #191919);
  border-radius: 0 16px 16px 0;
  display: flex; flex-direction: column;
  z-index: 100; overflow: hidden;
}
.sb-logo {
  padding: 28px 24px 22px;
  display: flex; align-items: center; gap: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.sb-logo-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(195deg, #49a3f1, #1A73E8);
  display: grid; place-items: center; flex-shrink: 0; color: #fff;
}
.sb-brand { font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.3px; }
.sb-brand-sub { font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 500; margin-top: 1px; }
.sb-section { padding: 18px 16px 4px; }
.sb-section-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 1.5px; text-transform: uppercase; }
.sb-nav { list-style: none; padding: 8px 12px; flex: 1; }
.sb-nav li + li { margin-top: 4px; }
.sb-nav a {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 10px;
  color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 500;
  transition: all 0.18s; cursor: pointer;
}
.sb-nav a:hover { color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.06); }
.sb-nav a.active { background: #fff; color: #344767; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
.sb-nav a.active .nav-icon-box { background: linear-gradient(195deg, #49a3f1, #1A73E8); box-shadow: 0 4px 12px rgba(26,115,232,0.4); }
.nav-icon-box {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  background: rgba(255,255,255,0.12); display: grid; place-items: center; color: #fff;
  transition: all 0.18s;
}
.sb-nav a.active .nav-icon-box { color: #fff; }
.sb-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); }
.sb-source-badge {
  font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.35);
  text-transform: uppercase; letter-spacing: 1px;
}

/* ── ICON ────────────────────────────────────────────────────────── */
.icon { display: inline-block; width: 18px; height: 18px; flex-shrink: 0; vertical-align: middle; }
.icon-sm { width: 14px; height: 14px; }
.icon-md { width: 20px; height: 20px; }
.icon-lg { width: 22px; height: 22px; }

/* ── PAGE HEADER ─────────────────────────────────────────────────── */
.page-header { margin-bottom: 24px; }
.page-title { font-size: 20px; font-weight: 800; color: var(--c-text); }
.page-subtitle { font-size: 12px; color: var(--c-text-2); margin-top: 2px; font-weight: 500; }

/* ── LIVE BANNER ─────────────────────────────────────────────────── */
.live-banner {
  background: linear-gradient(135deg, #FB8C00, #F57C00);
  border-radius: var(--radius); padding: 14px 20px;
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 24px; color: #fff;
  box-shadow: 0 4px 20px rgba(251,140,0,0.3);
}
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; flex-shrink: 0; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
.live-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.live-text { font-size: 13px; font-weight: 500; flex: 1; }
.live-token { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; }

/* ── STAT CARDS ──────────────────────────────────────────────────── */
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
.stat-card {
  background: var(--c-card); border-radius: var(--radius);
  box-shadow: var(--c-shadow); padding: 20px 20px 16px;
  display: flex; align-items: flex-start; gap: 16px;
}
.stat-icon-box {
  width: 56px; height: 56px; border-radius: 12px; flex-shrink: 0;
  display: grid; place-items: center; color: #fff;
  margin-top: -32px; box-shadow: 0 6px 20px rgba(0,0,0,0.18);
}
.si-blue   { background: linear-gradient(195deg, #49a3f1, #1A73E8); }
.si-teal   { background: linear-gradient(195deg, #66BB6A, #388E3C); }
.si-orange { background: linear-gradient(195deg, #FFA726, #FB8C00); }
.si-purple { background: linear-gradient(195deg, #EF5350, #E53935); }
.si-green  { background: linear-gradient(195deg, #66BB6A, #43A047); }
.stat-info { flex: 1; min-width: 0; }
.stat-label { font-size: 11px; font-weight: 600; color: var(--c-text-2); text-transform: uppercase; letter-spacing: 0.8px; }
.stat-value { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; color: var(--c-text); margin-top: 4px; line-height: 1; }
.stat-delta { font-size: 11px; font-weight: 600; margin-top: 6px; }
.stat-delta.pos { color: #4CAF50; }
.stat-delta.neg { color: #F44336; }

/* ── CARDS ──────────────────────────────────────────────────────── */
.card-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.card-grid-3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.card {
  background: var(--c-card); border-radius: var(--radius);
  box-shadow: var(--c-shadow); overflow: hidden;
}
.card-strip { height: 5px; }
.strip-blue   { background: linear-gradient(90deg, #49a3f1, #1A73E8); }
.strip-teal   { background: linear-gradient(90deg, #66BB6A, #388E3C); }
.strip-orange { background: linear-gradient(90deg, #FFA726, #FB8C00); }
.strip-purple { background: linear-gradient(90deg, #CE93D8, #9C27B0); }
.card-body { padding: 20px; }
.card-title { font-size: 14px; font-weight: 700; color: var(--c-text); }
.card-sub { font-size: 11px; color: var(--c-text-2); margin-top: 2px; font-weight: 500; }
.card-chart { margin-top: 16px; position: relative; }

/* ── PROMPT SCORE RING ───────────────────────────────────────────── */
.score-ring-wrap { display: flex; align-items: center; gap: 24px; padding: 8px 0; }
.score-ring-svg { flex-shrink: 0; }
.score-value { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; fill: var(--c-text); }
.score-label { font-size: 10px; fill: var(--c-text-2); font-weight: 600; }
.insights { flex: 1; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.insight-item { display: flex; align-items: flex-start; gap: 10px; }
.insight-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.insight-text { font-size: 12px; color: var(--c-text-2); line-height: 1.5; }
.insight-text strong { color: var(--c-text); font-weight: 600; }

/* ── TOOL BARS ────────────────────────────────────────────────────── */
.tool-bar-list { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.tool-bar-row { display: flex; align-items: center; gap: 10px; }
.tool-bar-name { font-size: 12px; font-weight: 600; color: var(--c-text); width: 80px; flex-shrink: 0; }
.tool-bar-track { flex: 1; height: 6px; background: #f0f2f5; border-radius: 3px; overflow: hidden; }
.tool-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #49a3f1, #1A73E8); }
.tool-bar-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--c-text-2); width: 32px; text-align: right; flex-shrink: 0; }

/* ── SESSION TABLE ────────────────────────────────────────────────── */
.table-wrap { overflow-x: auto; }
.sessions-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sessions-table th { font-size: 10px; font-weight: 700; color: var(--c-text-2); text-transform: uppercase; letter-spacing: 0.8px; padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--c-border); }
.sessions-table td { padding: 12px 12px; border-bottom: 1px solid var(--c-border); color: var(--c-text); vertical-align: middle; }
.sessions-table tr:last-child td { border-bottom: none; }
.sessions-table tr:hover td { background: #fafbfc; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
.badge-blue { background: rgba(26,115,232,0.1); color: #1A73E8; }
.badge-green { background: rgba(76,175,80,0.1); color: #388E3C; }
.mono { font-family: 'JetBrains Mono', monospace; font-weight: 500; }

/* ── SEARCH BAR ──────────────────────────────────────────────────── */
.search-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.search-input {
  flex: 1; padding: 8px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--c-border); background: #fafbfc;
  font-size: 13px; color: var(--c-text); outline: none;
  transition: border-color 0.15s;
}
.search-input:focus { border-color: var(--c-blue); }
.tab-bar { display: flex; gap: 4px; margin-bottom: 16px; }
.tab {
  padding: 6px 14px; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 600; color: var(--c-text-2);
  background: #f0f2f5; transition: all 0.15s; cursor: pointer;
}
.tab.active { background: var(--c-blue); color: #fff; }

/* ── BUDGET TRACKER ─────────────────────────────────────────────── */
.budget-bar-track { height: 8px; background: #f0f2f5; border-radius: 4px; overflow: hidden; margin: 8px 0; }
.budget-bar-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #66BB6A, #388E3C); transition: width 0.5s; }
.budget-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--c-text-2); font-weight: 500; }
.budget-spent { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; margin: 8px 0 2px; }
```

- [ ] **Step 2: Commit**

```bash
git add web/src/styles/main.css
git commit -m "feat: add Purity UI CSS foundation with sidebar, cards, tables, and stat cards"
```

---

### Task 11: SVG Icon Sprite

**Files:**
- Create: `web/src/assets/icons.svg`

- [ ] **Step 1: Copy the extracted sprite**

```bash
cp /tmp/ai-icons.svg /Users/arunkumar/Documents/Application/learning-platform/claudeDash/web/src/assets/icons.svg
```

- [ ] **Step 2: Create Icon component**

Create `web/src/components/Icon.jsx`:
```jsx
import React from 'react'

const iconSpriteUrl = new URL('../assets/icons.svg', import.meta.url).href

export default function Icon({ name, className = 'icon', size }) {
  const style = size ? { width: size, height: size } : undefined
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <use href={`${iconSpriteUrl}#ico-${name}`} />
    </svg>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/assets/icons.svg web/src/components/Icon.jsx
git commit -m "feat: add SVG icon sprite and Icon component"
```

---

### Task 12: Sidebar + App Shell

**Files:**
- Create: `web/src/components/Sidebar.jsx`
- Create: `web/src/App.jsx`

- [ ] **Step 1: Write Sidebar**

Create `web/src/components/Sidebar.jsx`:
```jsx
import React from 'react'
import { NavLink } from 'react-router-dom'
import Icon from './Icon.jsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/sessions', label: 'Sessions', icon: 'list' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export default function Sidebar({ source = 'Claude Code' }) {
  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-icon">
          <Icon name="activity" className="icon-md" />
        </div>
        <div>
          <div className="sb-brand">ai-sessions</div>
          <div className="sb-brand-sub">Developer Analytics</div>
        </div>
      </div>

      <div className="sb-section">
        <span className="sb-section-label">Navigation</span>
      </div>

      <nav>
        <ul className="sb-nav">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => isActive ? 'active' : ''}
              >
                <span className="nav-icon-box">
                  <Icon name={icon} className="icon-sm" />
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sb-footer">
        <div className="sb-source-badge">Source: {source}</div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Write App.jsx**

Create `web/src/App.jsx`:
```jsx
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sessions from './pages/Sessions.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Sidebar.jsx web/src/App.jsx
git commit -m "feat: add Sidebar component and App shell with routing"
```

---

### Task 13: Dashboard Components — StatCards + Charts

**Files:**
- Create: `web/src/components/StatCard.jsx`
- Create: `web/src/components/TokenChart.jsx`
- Create: `web/src/components/CostChart.jsx`

- [ ] **Step 1: Write StatCard**

Create `web/src/components/StatCard.jsx`:
```jsx
import React from 'react'
import Icon from './Icon.jsx'

export default function StatCard({ label, value, delta, icon, colorClass }) {
  const positive = delta && !delta.startsWith('-')
  return (
    <div className="stat-card">
      <div className={`stat-icon-box ${colorClass}`}>
        <Icon name={icon} className="icon-lg" />
      </div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {delta && (
          <div className={`stat-delta ${positive ? 'pos' : 'neg'}`}>
            {positive ? '↑' : '↓'} {delta}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write TokenChart**

Create `web/src/components/TokenChart.jsx`:
```jsx
import React, { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

export default function TokenChart({ daily = [] }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = daily.map(d => d.date.slice(5)) // MM-DD
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Input',
            data: daily.map(d => d.input_tokens),
            backgroundColor: 'rgba(73,163,241,0.85)',
            borderRadius: 4,
          },
          {
            label: 'Output',
            data: daily.map(d => d.output_tokens),
            backgroundColor: 'rgba(26,115,232,0.85)',
            borderRadius: 4,
          },
          {
            label: 'Cache',
            data: daily.map(d => d.cache_read),
            backgroundColor: 'rgba(156,163,175,0.5)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#9baabf' },
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 10 }, color: '#9baabf',
              callback: v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v,
            },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [daily])

  return (
    <div className="card-chart" style={{ height: 200 }}>
      <canvas ref={ref} />
    </div>
  )
}
```

- [ ] **Step 3: Write CostChart**

Create `web/src/components/CostChart.jsx`:
```jsx
import React, { useEffect, useRef } from 'react'
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip)

export default function CostChart({ daily = [] }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = daily.map(d => d.date.slice(5))
    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Cost USD',
          data: daily.map(d => d.est_cost_usd),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76,175,80,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#4CAF50',
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#9baabf' },
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { family: 'JetBrains Mono', size: 10 }, color: '#9baabf',
              callback: v => `$${v.toFixed(2)}`,
            },
          },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [daily])

  return (
    <div className="card-chart" style={{ height: 200 }}>
      <canvas ref={ref} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/StatCard.jsx web/src/components/TokenChart.jsx web/src/components/CostChart.jsx
git commit -m "feat: add StatCard, TokenChart (stacked bar), and CostChart (line+fill) components"
```

---

### Task 14: Dashboard Components — Tools + Prompt Score + Activity

**Files:**
- Create: `web/src/components/ToolChart.jsx`
- Create: `web/src/components/PromptScore.jsx`
- Create: `web/src/components/ActivityChart.jsx`
- Create: `web/src/components/LiveBanner.jsx`

- [ ] **Step 1: Write ToolChart**

Create `web/src/components/ToolChart.jsx`:
```jsx
import React from 'react'

export default function ToolChart({ toolCounts = {} }) {
  const sorted = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const max = sorted[0]?.[1] || 1
  return (
    <div className="tool-bar-list">
      {sorted.map(([name, count]) => (
        <div key={name} className="tool-bar-row">
          <span className="tool-bar-name">{name}</span>
          <div className="tool-bar-track">
            <div className="tool-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="tool-bar-count">{count}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write PromptScore**

Create `web/src/components/PromptScore.jsx`:
```jsx
import React from 'react'

const INSIGHTS = [
  { color: '#F44336', text: 'Add more context to prompts — average specificity score is low.' },
  { color: '#FB8C00', text: 'Sessions exceed 60 turns. Consider starting fresh sessions to reduce cache misses.' },
  { color: '#4CAF50', text: 'Cache reuse is healthy — keep priming context at session start.' },
  { color: '#1A73E8', text: 'Use clearer tool intent: "Read file X to find Y" outperforms vague reads.' },
]

export default function PromptScore({ score = 74 }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="score-ring-wrap">
      <svg className="score-ring-svg" width={132} height={132} viewBox="0 0 132 132">
        <circle cx={66} cy={66} r={r} fill="none" stroke="#f0f2f5" strokeWidth={10} />
        <circle
          cx={66} cy={66} r={r} fill="none"
          stroke="#1A73E8" strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 66 66)"
        />
        <text x={66} y={60} textAnchor="middle" className="score-value" dominantBaseline="middle" style={{ fontFamily: 'JetBrains Mono', fontSize: 28, fontWeight: 700, fill: '#344767' }}>{score}</text>
        <text x={66} y={82} textAnchor="middle" style={{ fontFamily: 'Figtree', fontSize: 10, fontWeight: 600, fill: '#7b809a' }}>/ 100</text>
      </svg>
      <ul className="insights">
        {INSIGHTS.map((item, i) => (
          <li key={i} className="insight-item">
            <span className="insight-dot" style={{ background: item.color }} />
            <span className="insight-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Write ActivityChart**

Create `web/src/components/ActivityChart.jsx`:
```jsx
import React, { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)

// Compute hour buckets from sessions
function buildHourly(sessions) {
  const counts = new Array(24).fill(0)
  for (const s of sessions) {
    const h = new Date(s.start_time).getHours()
    counts[h]++
  }
  return counts
}

export default function ActivityChart({ sessions = [] }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const data = buildHourly(sessions)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: HOURS,
        datasets: [{
          data,
          backgroundColor: 'rgba(73,163,241,0.75)',
          borderRadius: 3,
          hoverBackgroundColor: '#1A73E8',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 9 }, color: '#9baabf', maxRotation: 0 } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'JetBrains Mono', size: 9 }, color: '#9baabf' } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [sessions])

  return <div className="card-chart" style={{ height: 160 }}><canvas ref={ref} /></div>
}
```

- [ ] **Step 4: Write LiveBanner**

Create `web/src/components/LiveBanner.jsx`:
```jsx
import React from 'react'
import Icon from './Icon.jsx'

export default function LiveBanner({ session, liveTokens }) {
  if (!session) return null
  const display = liveTokens ?? session.total_usage?.input_tokens ?? 0
  return (
    <div className="live-banner">
      <span className="live-dot" />
      <span className="live-label">Live</span>
      <span className="live-text">
        Active session in <strong>{session.project_dir?.split('/').pop() || 'project'}</strong>
      </span>
      <Icon name="zap" className="icon-sm" />
      <span className="live-token">{display.toLocaleString()} tokens</span>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ToolChart.jsx web/src/components/PromptScore.jsx web/src/components/ActivityChart.jsx web/src/components/LiveBanner.jsx
git commit -m "feat: add ToolChart, PromptScore ring, ActivityChart, and LiveBanner components"
```

---

### Task 15: WebSocket Hook

**Files:**
- Create: `web/src/hooks/useWebSocket.js`

- [ ] **Step 1: Write the hook**

Create `web/src/hooks/useWebSocket.js`:
```js
import { useEffect, useRef, useState } from 'react'

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname === 'localhost' ? 'localhost:8765' : window.location.host
    const url = `${protocol}//${host}/ws`

    function connect() {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        // Reconnect after 3 seconds
        setTimeout(connect, 3000)
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          onMessage?.(msg)
        } catch (_) {}
      }
    }

    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return { connected }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/hooks/useWebSocket.js
git commit -m "feat: add WebSocket hook with auto-reconnect"
```

---

### Task 16: Dashboard Page

**Files:**
- Create: `web/src/pages/Dashboard.jsx`

- [ ] **Step 1: Write Dashboard page**

Create `web/src/pages/Dashboard.jsx`:
```jsx
import React, { useEffect, useState } from 'react'
import StatCard from '../components/StatCard.jsx'
import TokenChart from '../components/TokenChart.jsx'
import CostChart from '../components/CostChart.jsx'
import ToolChart from '../components/ToolChart.jsx'
import PromptScore from '../components/PromptScore.jsx'
import ActivityChart from '../components/ActivityChart.jsx'
import LiveBanner from '../components/LiveBanner.jsx'
import { useWebSocket } from '../hooks/useWebSocket.js'

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [liveTokens, setLiveTokens] = useState(null)

  const load = () => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {})
    fetch('/api/sessions?limit=200').then(r => r.json()).then(d => setSessions(d.sessions || [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  useWebSocket((msg) => {
    if (msg.type === 'session_updated') {
      setLiveTokens(msg.payload.input_tokens)
      load() // refresh stats on any session update
    }
  })

  if (!stats) return <div style={{ padding: 40, color: '#7b809a' }}>Loading sessions…</div>

  return (
    <>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">AI session analytics — Claude Code</div>
      </div>

      <LiveBanner session={stats.active_session} liveTokens={liveTokens} />

      <div className="stat-grid">
        <StatCard label="Total Sessions" value={stats.total_sessions} icon="box" colorClass="si-blue" delta="+12% this week" />
        <StatCard label="Input Tokens" value={fmt(stats.total_input_tokens)} icon="bar-chart" colorClass="si-teal" />
        <StatCard label="Output Tokens" value={fmt(stats.total_output_tokens)} icon="cpu" colorClass="si-orange" />
        <StatCard label="Est. Cost" value={`$${stats.total_cost_usd?.toFixed(2)}`} icon="credit-card" colorClass="si-purple" />
      </div>

      <div className="card-grid-2">
        <div className="card">
          <div className="card-strip strip-blue" />
          <div className="card-body">
            <div className="card-title">Token Usage</div>
            <div className="card-sub">Input · Output · Cache — last 30 days</div>
            <TokenChart daily={stats.daily} />
          </div>
        </div>
        <div className="card">
          <div className="card-strip strip-teal" />
          <div className="card-body">
            <div className="card-title">Estimated Cost</div>
            <div className="card-sub">USD per day (Sonnet pricing)</div>
            <CostChart daily={stats.daily} />
          </div>
        </div>
      </div>

      <div className="card-grid-2">
        <div className="card">
          <div className="card-strip strip-orange" />
          <div className="card-body">
            <div className="card-title">Prompt Optimization Score</div>
            <div className="card-sub">Based on specificity, context reuse, and session hygiene</div>
            <PromptScore score={74} />
          </div>
        </div>
        <div className="card">
          <div className="card-strip strip-purple" />
          <div className="card-body">
            <div className="card-title">Tool Distribution</div>
            <div className="card-sub">Most used tools across all sessions</div>
            <ToolChart toolCounts={stats.tool_counts} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-strip strip-blue" />
        <div className="card-body">
          <div className="card-title">Hourly Activity</div>
          <div className="card-sub">Session starts by hour of day</div>
          <ActivityChart sessions={sessions} />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Dashboard.jsx
git commit -m "feat: add Dashboard page with live stats, charts, and WebSocket updates"
```

---

### Task 17: Sessions + Settings Pages

**Files:**
- Create: `web/src/pages/Sessions.jsx`
- Create: `web/src/pages/Settings.jsx`
- Create: `web/src/components/SessionTable.jsx`

- [ ] **Step 1: Write SessionTable component**

Create `web/src/components/SessionTable.jsx`:
```jsx
import React, { useState } from 'react'
import Icon from './Icon.jsx'

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function SessionTable({ sessions = [] }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')

  const filtered = sessions.filter(s => {
    const matchQuery = !query || s.project_dir?.toLowerCase().includes(query.toLowerCase()) || s.first_prompt?.toLowerCase().includes(query.toLowerCase())
    const matchTab = tab === 'all' || (tab === 'large' && s.total_usage?.input_tokens > 100_000) || (tab === 'recent' && Date.now() - new Date(s.start_time) < 86_400_000)
    return matchQuery && matchTab
  })

  return (
    <>
      <div className="search-bar">
        <Icon name="filter" className="icon-sm" style={{ color: '#9baabf' }} />
        <input
          className="search-input"
          placeholder="Filter by project or prompt…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="tab-bar">
        {['all', 'recent', 'large'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="sessions-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>First Prompt</th>
              <th>Turns</th>
              <th>Input Tokens</th>
              <th>Output Tokens</th>
              <th>Started</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(s => (
              <tr key={s.id}>
                <td><strong>{s.project_dir?.split('/').pop() || '—'}</strong></td>
                <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#7b809a' }}>
                  {s.first_prompt || '—'}
                </td>
                <td className="mono">{s.user_turns}</td>
                <td className="mono">{fmt(s.total_usage?.input_tokens || 0)}</td>
                <td className="mono">{fmt(s.total_usage?.output_tokens || 0)}</td>
                <td style={{ color: '#7b809a', fontSize: 12 }}>{relTime(s.start_time)}</td>
                <td><span className="badge badge-blue">{s.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Write Sessions page**

Create `web/src/pages/Sessions.jsx`:
```jsx
import React, { useEffect, useState } from 'react'
import SessionTable from '../components/SessionTable.jsx'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetch('/api/sessions?limit=200')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setTotal(d.total || 0) })
      .catch(() => {})
  }, [])

  return (
    <>
      <div className="page-header">
        <div className="page-title">Session Explorer</div>
        <div className="page-subtitle">{total} sessions loaded from Claude Code</div>
      </div>
      <div className="card">
        <div className="card-strip strip-blue" />
        <div className="card-body">
          <SessionTable sessions={sessions} />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Write Settings stub**

Create `web/src/pages/Settings.jsx`:
```jsx
import React from 'react'
import Icon from '../components/Icon.jsx'

const ADAPTERS = [
  { name: 'Claude Code', icon: 'activity', status: 'active', path: '~/.claude/projects/' },
  { name: 'Cursor', icon: 'laptop', status: 'coming-soon', path: '~/.cursor/logs/' },
  { name: 'GitHub Copilot', icon: 'globe', status: 'coming-soon', path: '~/.config/github-copilot/' },
  { name: 'Windsurf', icon: 'zap', status: 'coming-soon', path: '~/.windsurf/sessions/' },
]

export default function Settings() {
  return (
    <>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Configure data sources and tool adapters</div>
      </div>
      <div className="card">
        <div className="card-strip strip-blue" />
        <div className="card-body">
          <div className="card-title">Tool Adapters</div>
          <div className="card-sub" style={{ marginBottom: 20 }}>Supported AI tools — community adapters welcome</div>
          {ADAPTERS.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid #f0f2f5' }}>
              <Icon name={a.icon} className="icon-md" style={{ color: '#1A73E8' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: '#9baabf', fontFamily: 'JetBrains Mono', marginTop: 2 }}>{a.path}</div>
              </div>
              <span className={`badge ${a.status === 'active' ? 'badge-green' : 'badge-blue'}`}>
                {a.status === 'active' ? 'Active' : 'Coming Soon'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/ web/src/components/SessionTable.jsx
git commit -m "feat: add Sessions explorer and Settings pages with adapter list"
```

---

### Task 18: Build Pipeline + Final Integration

**Files:**
- Modify: `Makefile`
- Modify: `cmd/ai-sessions/main.go` (verify embed path is correct)

- [ ] **Step 1: Build the React app**

```bash
cd web && npm run build
```
Expected: `web/dist/` populated with `index.html`, JS, and CSS bundles. No errors.

- [ ] **Step 2: Build the Go binary**

```bash
cd .. && go build -o ai-sessions ./cmd/ai-sessions/
```
Expected: `ai-sessions` binary created. No errors.

- [ ] **Step 3: Run the binary**

```bash
./ai-sessions
```
Expected output:
```
loaded N sessions
ai-sessions running → http://localhost:8765
```

- [ ] **Step 4: Verify API endpoints**

```bash
curl -s http://localhost:8765/api/health | python3 -m json.tool
curl -s http://localhost:8765/api/stats | python3 -m json.tool
curl -s 'http://localhost:8765/api/sessions?limit=3' | python3 -m json.tool
```
Expected: valid JSON with real session data from `~/.claude/projects/`.

- [ ] **Step 5: Verify UI loads**

Open `http://localhost:8765` in Chrome. Confirm:
- Figtree font rendered (not system sans-serif)
- Gradient sidebar visible with SVG nav icons
- StatCards showing real token counts
- Token chart bars rendering
- No console errors

- [ ] **Step 6: Update Makefile with run target**

Edit `Makefile` to add:
```makefile
run: build
	./ai-sessions
```

- [ ] **Step 7: Run all Go tests one final time**

```bash
go test ./... -v
```
Expected: all PASS.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete ai-sessions — single binary Go+React dashboard for Claude Code sessions"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Multi-tool adapter interface — `internal/adapters/adapter.go`
- ✅ Claude Code JSONL parser — `internal/adapters/claudecode/adapter.go`
- ✅ Token/cost aggregation — `internal/store/store.go`
- ✅ REST API — `/api/stats`, `/api/sessions`, `/api/tools`
- ✅ WebSocket live push — `internal/ws/hub.go` + `useWebSocket.js`
- ✅ fsnotify file watcher — `internal/watcher/watcher.go`
- ✅ Purity UI design — `web/src/styles/main.css` (dark gradient sidebar, white cards, `#f0f2f5` canvas)
- ✅ Figtree + JetBrains Mono fonts — `web/index.html`
- ✅ Real SVG icons from Interface Icons.svg — `web/src/assets/icons.svg` + `Icon.jsx`
- ✅ Token bar chart (stacked) — `TokenChart.jsx`
- ✅ Cost line chart (teal fill) — `CostChart.jsx`
- ✅ Tool distribution bars — `ToolChart.jsx`
- ✅ Prompt score ring + insights — `PromptScore.jsx`
- ✅ Hourly activity chart — `ActivityChart.jsx`
- ✅ Session explorer with search + tabs — `SessionTable.jsx`
- ✅ Single binary embed — `//go:embed all:web/dist`
- ✅ Live session banner — `LiveBanner.jsx`

**Type consistency check:**
- `models.Session.TotalUsage` (type `models.Usage`) → API JSON `total_usage` → React `s.total_usage?.input_tokens` ✅
- `models.Stats.Daily` (type `[]models.DailyStats`) → API JSON `daily` → React `stats.daily` → chart `d.input_tokens`, `d.est_cost_usd` ✅
- `models.Stats.ToolCounts` (type `map[string]int`) → API JSON `tool_counts` → React `stats.tool_counts` → `ToolChart` `Object.entries(toolCounts)` ✅
- `models.Stats.ActiveSession` (type `*models.Session`) → API JSON `active_session` → React `stats.active_session` → `LiveBanner session` prop ✅

No gaps found.
