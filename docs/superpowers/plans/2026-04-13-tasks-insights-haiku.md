# Tasks Panel + Prompt Insights Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface `~/.claude/tasks/` as a Dashboard widget + full Tasks page, replace inflated prompt scoring with meaningful token-efficiency tiers (Beginner→Expert), and add Claude Haiku-powered prompt analysis with concrete rewrite suggestions.

**Architecture:** Three independent slices — Tasks (new API + 2 components), Insights rewrite (same endpoint, new metrics + tier logic), Haiku (Go HTTP client + 24h disk cache + frontend AI section). All slices share updated models and the existing handler pattern.

**Tech Stack:** Go 1.26 (net/http, encoding/json, crypto/sha256), React 18 (JSX, hooks), Vite, existing `useWebSocket` hook, Anthropic Messages API (`claude-haiku-4-5-20251001`).

---

## File Map

**Create:**
- `internal/models/tasks.go` — TaskItem, ProjectTaskSummary, TasksResponse
- `internal/models/haiku.go` — HaikuAnalysis, HaikuImprovement, HaikuRewrite, HaikuCache
- `internal/api/tasks.go` — getTasks handler
- `internal/api/haiku.go` — callHaiku(), loadHaikuCache(), saveHaikuCache()
- `web/src/components/TasksPanel.jsx` — Dashboard widget
- `web/src/pages/Tasks.jsx` — full Tasks page

**Modify:**
- `internal/models/models.go` — add Tier + Value fields to InsightDimension; add Tier, AIAnalysis, AILoading to InsightsResponse
- `internal/api/handlers.go` — register /api/tasks; rewrite getInsights (new metrics, tier system, Haiku trigger)
- `web/src/App.jsx` — add /tasks route
- `web/src/components/Sidebar.jsx` — add Tasks nav item
- `web/src/pages/Dashboard.jsx` — import + render TasksPanel
- `web/src/components/PromptScore.jsx` — render tiers, new dimensions, AI analysis section

---

## Task 1: Task models

**Files:**
- Create: `internal/models/tasks.go`

- [ ] **Step 1: Create the file**

```go
package models

import "time"

// TaskItem is one task from ~/.claude/tasks/{sessionID}/{n}.json
type TaskItem struct {
	ID          string   `json:"id"`
	Subject     string   `json:"subject"`
	Description string   `json:"description"`
	ActiveForm  string   `json:"active_form"`
	Status      string   `json:"status"` // "completed" | "in_progress" | "pending"
	Blocks      []string `json:"blocks"`
	BlockedBy   []string `json:"blocked_by"`
	SessionID   string   `json:"session_id"`
	SessionDate string   `json:"session_date"` // "2006-01-02"
	ProjectDir  string   `json:"project_dir"`
}

// ProjectTaskSummary aggregates tasks for one project
type ProjectTaskSummary struct {
	ProjectDir     string     `json:"project_dir"`
	Completed      int        `json:"completed"`
	InProgress     int        `json:"in_progress"`
	Pending        int        `json:"pending"`
	CompletionRate int        `json:"completion_rate"` // 0-100
	Tasks          []TaskItem `json:"tasks"`
}

// TasksResponse is returned by GET /api/tasks
type TasksResponse struct {
	Projects []ProjectTaskSummary `json:"projects"`
	Summary  TasksSummary         `json:"summary"`
}

type TasksSummary struct {
	Total      int `json:"total"`
	Completed  int `json:"completed"`
	InProgress int `json:"in_progress"`
	Pending    int `json:"pending"`
}

// rawTask mirrors the on-disk JSON format from Claude Code
type rawTask struct {
	ID          string   `json:"id"`
	Subject     string   `json:"subject"`
	Description string   `json:"description"`
	ActiveForm  string   `json:"activeForm"`
	Status      string   `json:"status"`
	Blocks      []string `json:"blocks"`
	BlockedBy   []string `json:"blockedBy"`
}

// ToTaskItem converts a rawTask to a TaskItem with session metadata
func (r rawTask) ToTaskItem(sessionID, projectDir string, sessionDate time.Time) TaskItem {
	dateStr := ""
	if !sessionDate.IsZero() {
		dateStr = sessionDate.Format("2006-01-02")
	}
	blocks := r.Blocks
	if blocks == nil {
		blocks = []string{}
	}
	blockedBy := r.BlockedBy
	if blockedBy == nil {
		blockedBy = []string{}
	}
	return TaskItem{
		ID:          r.ID,
		Subject:     r.Subject,
		Description: r.Description,
		ActiveForm:  r.ActiveForm,
		Status:      r.Status,
		Blocks:      blocks,
		BlockedBy:   blockedBy,
		SessionID:   sessionID,
		SessionDate: dateStr,
		ProjectDir:  projectDir,
	}
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard && go build ./...
```
Expected: no output (clean build)

- [ ] **Step 3: Commit**

```bash
git add internal/models/tasks.go
git commit -m "feat: add task models (TaskItem, ProjectTaskSummary, TasksResponse)"
```

---

## Task 2: Haiku models

**Files:**
- Create: `internal/models/haiku.go`

- [ ] **Step 1: Create the file**

```go
package models

import "time"

// HaikuImprovement is one actionable prompt improvement from Haiku
type HaikuImprovement struct {
	Pattern    string `json:"pattern"`    // what the user does wrong
	ExampleFix string `json:"example_fix"` // "before → after" one-liner
	Impact     string `json:"impact"`     // "high" | "medium"
}

// HaikuRewrite is a full before/after rewrite of the user's weakest prompt
type HaikuRewrite struct {
	Original string `json:"original"`
	Improved string `json:"improved"`
	Why      string `json:"why"`
}

// HaikuAnalysis is the structured response from Claude Haiku
type HaikuAnalysis struct {
	TierJustification string             `json:"tier_justification"`
	TopImprovements   []HaikuImprovement `json:"top_improvements"`
	Strengths         []string           `json:"strengths"`
	Rewrite           *HaikuRewrite      `json:"rewrite,omitempty"`
	AnalyzedAt        time.Time          `json:"analyzed_at"`
	PromptCount       int                `json:"prompt_count"`
}

// HaikuCache is persisted to ~/.claude/ai-sessions-haiku-cache.json
type HaikuCache struct {
	Analysis   *HaikuAnalysis `json:"analysis"`
	AnalyzedAt time.Time      `json:"analyzed_at"`
	PromptHash string         `json:"prompt_hash"` // SHA-256 of prompt sample
}
```

- [ ] **Step 2: Update InsightDimension and InsightsResponse in models.go**

In `internal/models/models.go`, replace the existing `InsightDimension` and `InsightsResponse` types:

```go
// InsightDimension is one scored dimension in the prompt quality breakdown
type InsightDimension struct {
	Label string `json:"label"`
	Score int    `json:"score"` // 0-100 for bar width
	Tier  string `json:"tier"`  // "Expert" | "Advanced" | "Intermediate" | "Beginner"
	Value string `json:"value"` // human-readable: "3.2×", "18%", "42 chars"
}

// InsightsResponse is the full response for /api/insights
type InsightsResponse struct {
	Score      int                `json:"score"`       // numeric 0-100 (derived from tier)
	Tier       string             `json:"tier"`        // overall tier (weakest-link)
	Dimensions []InsightDimension `json:"dimensions"`
	Insights   []Insight          `json:"insights"`
	// Raw metrics
	CachePct        float64        `json:"cache_pct"`
	AvgTurns        float64        `json:"avg_turns"`
	HighCtxSessions int            `json:"high_ctx_sessions"`
	SpecificPct     float64        `json:"specific_pct"`
	TotalSessions   int            `json:"total_sessions"`
	AvgPromptLen    float64        `json:"avg_prompt_len"`
	OutputRatio     float64        `json:"output_ratio"`     // output/input
	OwnershipPct    float64        `json:"ownership_pct"`    // fresh input %
	// Haiku AI analysis
	AIAnalysis *HaikuAnalysis `json:"ai_analysis,omitempty"`
	AILoading  bool           `json:"ai_loading,omitempty"`
}
```

- [ ] **Step 3: Build to verify**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard && go build ./...
```
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add internal/models/haiku.go internal/models/models.go
git commit -m "feat: add Haiku models and update InsightDimension/InsightsResponse with tier fields"
```

---

## Task 3: GET /api/tasks handler

**Files:**
- Create: `internal/api/tasks.go`
- Modify: `internal/api/handlers.go` (register route)

- [ ] **Step 1: Create internal/api/tasks.go**

```go
package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/ai-sessions/ai-sessions/internal/models"
)

// getTasks handles GET /api/tasks
// Reads ~/.claude/tasks/{sessionID}/*.json and cross-references the session store.
func (h *Handler) getTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	home, _ := os.UserHomeDir()
	tasksDir := filepath.Join(home, ".claude", "tasks")

	// Build sessionID → session lookup for project + date
	sessions := h.Store.Sessions()
	sessMap := make(map[string]*struct {
		projectDir string
		startTime  interface{ IsZero() bool }
	})
	_ = sessMap

	// projectDir → tasks
	projectMap := make(map[string]*models.ProjectTaskSummary)
	summary := models.TasksSummary{}

	entries, err := os.ReadDir(tasksDir)
	if err != nil {
		writeJSON(w, models.TasksResponse{
			Projects: []models.ProjectTaskSummary{},
			Summary:  summary,
		})
		return
	}

	// Find session for each task directory
	for _, sessionDir := range entries {
		if !sessionDir.IsDir() {
			continue
		}
		sessionID := sessionDir.Name()
		sessionPath := filepath.Join(tasksDir, sessionID)

		// Look up project dir and session date from store
		projectDir := "unknown"
		sessionDate := ""
		for _, sess := range sessions {
			if sess.ID == sessionID {
				projectDir = sess.ProjectDir
				if !sess.StartTime.IsZero() {
					sessionDate = sess.StartTime.Format("2006-01-02")
				}
				break
			}
		}

		// Read all task JSON files in this session directory
		taskFiles, err := os.ReadDir(sessionPath)
		if err != nil {
			continue
		}

		for _, tf := range taskFiles {
			if tf.IsDir() || !strings.HasSuffix(tf.Name(), ".json") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(sessionPath, tf.Name()))
			if err != nil {
				continue
			}
			var raw struct {
				ID          string   `json:"id"`
				Subject     string   `json:"subject"`
				Description string   `json:"description"`
				ActiveForm  string   `json:"activeForm"`
				Status      string   `json:"status"`
				Blocks      []string `json:"blocks"`
				BlockedBy   []string `json:"blockedBy"`
			}
			if err := json.Unmarshal(data, &raw); err != nil {
				continue
			}
			if raw.Subject == "" {
				continue
			}

			item := models.TaskItem{
				ID:          raw.ID,
				Subject:     raw.Subject,
				Description: raw.Description,
				ActiveForm:  raw.ActiveForm,
				Status:      raw.Status,
				Blocks:      raw.Blocks,
				BlockedBy:   raw.BlockedBy,
				SessionID:   sessionID,
				SessionDate: sessionDate,
				ProjectDir:  projectDir,
			}
			if item.Blocks == nil {
				item.Blocks = []string{}
			}
			if item.BlockedBy == nil {
				item.BlockedBy = []string{}
			}

			// Aggregate into project
			if _, ok := projectMap[projectDir]; !ok {
				projectMap[projectDir] = &models.ProjectTaskSummary{
					ProjectDir: projectDir,
					Tasks:      []models.TaskItem{},
				}
			}
			p := projectMap[projectDir]
			p.Tasks = append(p.Tasks, item)

			switch raw.Status {
			case "completed":
				p.Completed++
				summary.Completed++
			case "in_progress":
				p.InProgress++
				summary.InProgress++
			default:
				p.Pending++
				summary.Pending++
			}
			summary.Total++
		}
	}

	// Compute completion rates and sort tasks newest-session-first
	var projects []models.ProjectTaskSummary
	for _, p := range projectMap {
		total := p.Completed + p.InProgress + p.Pending
		if total > 0 {
			p.CompletionRate = int(float64(p.Completed) / float64(total) * 100)
		}
		// Sort tasks: in_progress first, then completed, then pending
		sort.SliceStable(p.Tasks, func(i, j int) bool {
			order := map[string]int{"in_progress": 0, "completed": 1, "pending": 2}
			return order[p.Tasks[i].Status] < order[p.Tasks[j].Status]
		})
		projects = append(projects, *p)
	}

	// Sort projects by total task count descending
	sort.Slice(projects, func(i, j int) bool {
		ti := projects[i].Completed + projects[i].InProgress + projects[i].Pending
		tj := projects[j].Completed + projects[j].InProgress + projects[j].Pending
		return ti > tj
	})

	writeJSON(w, models.TasksResponse{
		Projects: projects,
		Summary:  summary,
	})
}
```

- [ ] **Step 2: Register the route in handlers.go**

In `internal/api/handlers.go`, add to the `Register` method after the existing routes:

```go
mux.HandleFunc("/api/tasks", h.getTasks)
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard && go build ./...
```

- [ ] **Step 4: Smoke-test the endpoint**

```bash
curl -s http://localhost:8765/api/tasks | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('total tasks:', d['summary']['total'])
print('completed:', d['summary']['completed'])
print('in_progress:', d['summary']['in_progress'])
print('pending:', d['summary']['pending'])
print('projects:', len(d['projects']))
for p in d['projects'][:3]:
    print(' ', p['project_dir'][-40:], 'done=', p['completed'], 'active=', p['in_progress'])
"
```
Expected: total ~72, projects grouped by dir, in_progress tasks first within each project.

- [ ] **Step 5: Commit**

```bash
git add internal/api/tasks.go internal/api/handlers.go
git commit -m "feat: add GET /api/tasks endpoint - reads ~/.claude/tasks/ grouped by project"
```

---

## Task 4: Haiku HTTP client + cache

**Files:**
- Create: `internal/api/haiku.go`

- [ ] **Step 1: Create internal/api/haiku.go**

```go
package api

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/models"
)

const haikuCacheFile = ".claude/ai-sessions-haiku-cache.json"
const haikuCacheTTL = 24 * time.Hour
const haikuModel = "claude-haiku-4-5-20251001"

// loadHaikuCache reads the on-disk cache; returns nil if missing or expired.
func loadHaikuCache() *models.HaikuCache {
	home, _ := os.UserHomeDir()
	data, err := os.ReadFile(filepath.Join(home, haikuCacheFile))
	if err != nil {
		return nil
	}
	var c models.HaikuCache
	if err := json.Unmarshal(data, &c); err != nil {
		return nil
	}
	if time.Since(c.AnalyzedAt) > haikuCacheTTL {
		return nil // expired
	}
	return &c
}

// saveHaikuCache writes the cache atomically.
func saveHaikuCache(c *models.HaikuCache) {
	home, _ := os.UserHomeDir()
	data, err := json.Marshal(c)
	if err != nil {
		return
	}
	path := filepath.Join(home, haikuCacheFile)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return
	}
	_ = os.Rename(tmp, path)
}

// promptHash returns a short SHA-256 fingerprint of the prompt sample.
func promptHash(prompts []string) string {
	h := sha256.New()
	for _, p := range prompts {
		h.Write([]byte(p))
		h.Write([]byte{0})
	}
	return fmt.Sprintf("%x", h.Sum(nil))[:16]
}

// callHaiku samples recent prompts from sessions and calls Claude Haiku.
// Returns the analysis or an error. Does NOT cache — callers manage caching.
func callHaiku(sessions interface{ Sessions() interface{} }, promptSamples []string) (*models.HaikuAnalysis, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY not set")
	}
	if len(promptSamples) == 0 {
		return nil, fmt.Errorf("no prompts to analyze")
	}

	// Build numbered prompt list
	var sb strings.Builder
	for i, p := range promptSamples {
		fmt.Fprintf(&sb, "%d. %s\n\n", i+1, p)
	}

	systemPrompt := `You are an expert at analyzing how developers use Claude Code. 
Analyze the user's prompts and return a JSON object with exactly this structure (no markdown, raw JSON only):
{
  "tier_justification": "one sentence explaining the overall tier",
  "top_improvements": [
    {"pattern": "what they do wrong", "example_fix": "before → after one-liner", "impact": "high"},
    {"pattern": "second issue", "example_fix": "before → after", "impact": "medium"}
  ],
  "strengths": ["what they do well (max 2 items)"],
  "rewrite": {
    "original": "copy the weakest prompt verbatim",
    "improved": "your improved version",
    "why": "one sentence explanation"
  }
}
Only return the JSON. No explanation, no markdown fences.`

	userMsg := fmt.Sprintf("Here are %d recent Claude Code prompts from this developer:\n\n%s\nAnalyze these prompts and return the JSON.", len(promptSamples), sb.String())

	reqBody, _ := json.Marshal(map[string]any{
		"model":      haikuModel,
		"max_tokens": 1024,
		"system":     systemPrompt,
		"messages": []map[string]any{
			{"role": "user", "content": userMsg},
		},
	})

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var apiResp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}
	if apiResp.Error != nil {
		return nil, fmt.Errorf("anthropic API error: %s", apiResp.Error.Message)
	}
	if len(apiResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from Haiku")
	}

	raw := strings.TrimSpace(apiResp.Content[0].Text)
	// Strip markdown fences if Haiku added them anyway
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var analysis models.HaikuAnalysis
	if err := json.Unmarshal([]byte(raw), &analysis); err != nil {
		return nil, fmt.Errorf("parse haiku JSON: %w (raw: %.200s)", err, raw)
	}
	analysis.AnalyzedAt = time.Now()
	analysis.PromptCount = len(promptSamples)
	return &analysis, nil
}

// samplePrompts pulls up to maxN recent non-trivial first prompts from sessions.
func samplePrompts(sessions []*models.Session, maxN int) []string {
	var out []string
	for _, s := range sessions {
		p := strings.TrimSpace(s.FirstPrompt)
		if len(p) < 10 {
			continue
		}
		// Skip skill injections that leaked through
		if strings.HasPrefix(p, "Base directory") || strings.HasPrefix(p, "<command") {
			continue
		}
		out = append(out, p)
		if len(out) >= maxN {
			break
		}
	}
	return out
}
```

- [ ] **Step 2: Fix the callHaiku signature — it takes a sessions slice directly**

Replace the `callHaiku` function signature with:

```go
func callHaiku(promptSamples []string) (*models.HaikuAnalysis, error) {
```

(Remove the `sessions` parameter entirely — it was unused; the caller already passes `promptSamples`.)

- [ ] **Step 3: Build to verify**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard && go build ./...
```
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add internal/api/haiku.go
git commit -m "feat: add Haiku HTTP client with 24h disk cache (callHaiku, samplePrompts, loadHaikuCache, saveHaikuCache)"
```

---

## Task 5: Rewrite getInsights — new metrics, tiers, Haiku trigger

**Files:**
- Modify: `internal/api/handlers.go` — replace `getInsights`, `clampScore`, `promptLenToScore`

- [ ] **Step 1: Add tier helper at bottom of handlers.go (before clampScore)**

```go
// tierName converts a 0-3 integer to a tier label.
// 0=Beginner, 1=Intermediate, 2=Advanced, 3=Expert
func tierName(t int) string {
	switch t {
	case 3:
		return "Expert"
	case 2:
		return "Advanced"
	case 1:
		return "Intermediate"
	default:
		return "Beginner"
	}
}

// tierScore maps tier → representative numeric score for the ring display.
func tierScore(tier string) int {
	switch tier {
	case "Expert":
		return 95
	case "Advanced":
		return 75
	case "Intermediate":
		return 50
	default:
		return 25
	}
}

// tierToBarScore maps a tier label to a 0-100 bar width for the dimension bars.
func tierToBarScore(tier string) int {
	switch tier {
	case "Expert":
		return 92
	case "Advanced":
		return 68
	case "Intermediate":
		return 42
	default:
		return 18
	}
}

// outputRatioTier returns 0-3 tier for the output/input ratio.
func outputRatioTier(ratio float64) int {
	switch {
	case ratio > 3.0:
		return 3
	case ratio > 2.0:
		return 2
	case ratio > 1.0:
		return 1
	default:
		return 0
	}
}

// ownershipTier returns 0-3 tier for fresh-input ownership %.
func ownershipTier(pct float64) int {
	switch {
	case pct > 25:
		return 3
	case pct > 15:
		return 2
	case pct > 8:
		return 1
	default:
		return 0
	}
}

// specificityTier returns 0-3 tier for % of prompts referencing code/files.
func specificityTier(pct float64) int {
	switch {
	case pct > 60:
		return 3
	case pct > 40:
		return 2
	case pct > 20:
		return 1
	default:
		return 0
	}
}

// hygieneTier returns 0-3 tier based on average turns per session.
func hygieneTier(avgTurns float64) int {
	switch {
	case avgTurns < 12:
		return 3
	case avgTurns < 20:
		return 2
	case avgTurns < 35:
		return 1
	default:
		return 0
	}
}
```

- [ ] **Step 2: Replace getInsights in handlers.go**

Replace the entire `getInsights` function (lines ~656–827) with:

```go
// getInsights computes token-efficiency metrics, tiers, and triggers Haiku analysis.
// GET /api/insights?days=30&refresh=1
func (h *Handler) getInsights(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 {
		days = 30
	}
	forceRefresh := r.URL.Query().Get("refresh") == "1"

	allSessions := h.Store.Sessions()
	cutoff := time.Now().AddDate(0, 0, -days)
	var sessions []*models.Session
	for _, s := range allSessions {
		if s.StartTime.After(cutoff) {
			sessions = append(sessions, s)
		}
	}
	if len(sessions) == 0 {
		sessions = allSessions
	}
	if len(sessions) == 0 {
		writeJSON(w, models.InsightsResponse{Tier: "Beginner", Score: 25, Dimensions: []models.InsightDimension{}})
		return
	}

	// ── Output Ratio ─────────────────────────────────────────────────────────
	// output_tokens / input_tokens — how much work Claude did per token spent
	var totalInput, totalOutput int64
	for _, s := range sessions {
		totalInput += int64(s.TotalUsage.InputTokens)
		totalOutput += int64(s.TotalUsage.OutputTokens)
	}
	outputRatio := 0.0
	if totalInput > 0 {
		outputRatio = float64(totalOutput) / float64(totalInput)
	}
	outputRatioT := outputRatioTier(outputRatio)

	// ── Prompt Ownership ─────────────────────────────────────────────────────
	// fresh_input / (fresh_input + cache_read) — how much of input is new content
	var totalFreshInput, totalCacheRead int64
	for _, s := range sessions {
		totalFreshInput += int64(s.TotalUsage.InputTokens)
		totalCacheRead += int64(s.TotalUsage.CacheReadInputTokens)
	}
	ownershipPct := 0.0
	if totalFreshInput+totalCacheRead > 0 {
		ownershipPct = float64(totalFreshInput) / float64(totalFreshInput+totalCacheRead) * 100
	}
	ownershipT := ownershipTier(ownershipPct)

	// ── Specificity ───────────────────────────────────────────────────────────
	specificCount := 0
	for _, s := range sessions {
		if isSpecificPrompt(s.FirstPrompt) {
			specificCount++
		}
	}
	specificPct := float64(specificCount) / float64(len(sessions)) * 100
	specificT := specificityTier(specificPct)

	// ── Session Hygiene ───────────────────────────────────────────────────────
	var totalTurns int
	highCtxSessions := 0
	for _, s := range sessions {
		totalTurns += s.UserTurns
		if s.UserTurns > 50 {
			highCtxSessions++
		}
	}
	avgTurns := float64(totalTurns) / float64(len(sessions))
	hygieneT := hygieneTier(avgTurns)

	// ── Overall Tier (weakest link) ────────────────────────────────────────────
	minTier := outputRatioT
	if ownershipT < minTier {
		minTier = ownershipT
	}
	if specificT < minTier {
		minTier = specificT
	}
	if hygieneT < minTier {
		minTier = hygieneT
	}
	overallTier := tierName(minTier)
	overallScore := tierScore(overallTier)

	// ── Dimensions ────────────────────────────────────────────────────────────
	ratioStr := fmt.Sprintf("%.1f×", outputRatio)
	ownerStr := fmt.Sprintf("%.0f%%", ownershipPct)
	specStr := fmt.Sprintf("%.0f%%", specificPct)
	hygieneStr := fmt.Sprintf("%.1f turns", avgTurns)

	dimensions := []models.InsightDimension{
		{
			Label: "Output ratio",
			Score: tierToBarScore(tierName(outputRatioT)),
			Tier:  tierName(outputRatioT),
			Value: ratioStr,
		},
		{
			Label: "Prompt ownership",
			Score: tierToBarScore(tierName(ownershipT)),
			Tier:  tierName(ownershipT),
			Value: ownerStr,
		},
		{
			Label: "Specificity",
			Score: tierToBarScore(tierName(specificT)),
			Tier:  tierName(specificT),
			Value: specStr,
		},
		{
			Label: "Session hygiene",
			Score: tierToBarScore(tierName(hygieneT)),
			Tier:  tierName(hygieneT),
			Value: hygieneStr,
		},
	}

	// ── Dynamic Insights ──────────────────────────────────────────────────────
	var insights []models.Insight

	// Output ratio insight
	if outputRatioT < 2 {
		insights = append(insights, models.Insight{
			Type:  "warning",
			Title: "Low Output Ratio",
			Text:  fmt.Sprintf("Claude produces %.1f× your input. Aim for 2×+ by asking for complete implementations rather than explaining what you want step-by-step.", outputRatio),
		})
	} else {
		insights = append(insights, models.Insight{
			Type:  "success",
			Title: "Strong Output Ratio",
			Text:  fmt.Sprintf("%.1f× output per input token — Claude is doing heavy lifting. Good delegation pattern.", outputRatio),
		})
	}

	// Ownership insight
	if ownershipT < 2 {
		insights = append(insights, models.Insight{
			Type:  "info",
			Title: "High Context Overhead",
			Text:  fmt.Sprintf("Only %.0f%% of tokens are your new content — the rest is repeated context (CLAUDE.md, history). Shorter, focused sessions reduce re-sent context.", ownershipPct),
		})
	} else {
		insights = append(insights, models.Insight{
			Type:  "success",
			Title: "Efficient Context Use",
			Text:  fmt.Sprintf("%.0f%% of input tokens are your new instructions — context overhead is well-managed.", ownershipPct),
		})
	}

	// Specificity insight
	if specificT < 2 {
		insights = append(insights, models.Insight{
			Type:  "info",
			Title: "Low Prompt Specificity",
			Text:  fmt.Sprintf("%.0f%% of prompts reference specific files or code. Include file paths and function names to cut search overhead.", specificPct),
		})
	} else {
		insights = append(insights, models.Insight{
			Type:  "success",
			Title: "Specific Prompts",
			Text:  fmt.Sprintf("%.0f%% of prompts cite specific files or code — reduces unnecessary tool calls.", specificPct),
		})
	}

	// Hygiene insight
	if highCtxSessions > 0 {
		insights = append(insights, models.Insight{
			Type:  "warning",
			Title: "Long Sessions Detected",
			Text:  fmt.Sprintf("%d session%s exceeded 50 turns. Use /clear between unrelated tasks to avoid context bloat.", highCtxSessions, pluralS(highCtxSessions)),
		})
	} else if hygieneT < 2 {
		insights = append(insights, models.Insight{
			Type:  "info",
			Title: "Session Length",
			Text:  fmt.Sprintf("Average %.1f turns/session. Consider /clear when switching between unrelated tasks.", avgTurns),
		})
	} else {
		insights = append(insights, models.Insight{
			Type:  "success",
			Title: "Session Hygiene Good",
			Text:  fmt.Sprintf("Average %.1f turns/session — sessions stay focused.", avgTurns),
		})
	}

	// ── Avg prompt length (for legacy raw metric) ────────────────────────────
	var totalLen int
	for _, s := range sessions {
		totalLen += len(s.FirstPrompt)
	}
	avgPromptLen := float64(totalLen) / float64(len(sessions))

	// ── Haiku AI Analysis ─────────────────────────────────────────────────────
	var aiAnalysis *models.HaikuAnalysis
	aiLoading := false

	if !forceRefresh {
		if cached := loadHaikuCache(); cached != nil {
			aiAnalysis = cached.Analysis
		}
	}

	if aiAnalysis == nil {
		// Return immediately with aiLoading=true; trigger background analysis
		aiLoading = true
		prompts := samplePrompts(sessions, 15)
		go func() {
			analysis, err := callHaiku(prompts)
			if err != nil {
				return
			}
			saveHaikuCache(&models.HaikuCache{
				Analysis:   analysis,
				AnalyzedAt: analysis.AnalyzedAt,
				PromptHash: promptHash(prompts),
			})
		}()
	}

	writeJSON(w, models.InsightsResponse{
		Score:           overallScore,
		Tier:            overallTier,
		Dimensions:      dimensions,
		Insights:        insights,
		CachePct:        0, // removed — kept for JSON compat
		AvgTurns:        math.Round(avgTurns*10) / 10,
		HighCtxSessions: highCtxSessions,
		SpecificPct:     math.Round(specificPct*10) / 10,
		TotalSessions:   len(sessions),
		AvgPromptLen:    math.Round(avgPromptLen),
		OutputRatio:     math.Round(outputRatio*100) / 100,
		OwnershipPct:    math.Round(ownershipPct*10) / 10,
		AIAnalysis:      aiAnalysis,
		AILoading:       aiLoading,
	})
}
```

- [ ] **Step 3: Remove the now-unused cacheScore / old score functions**

Delete these functions from `handlers.go` (they're replaced by the tier helpers):
- `clampScore(v int) int`
- `promptLenToScore(avgLen float64) int`

- [ ] **Step 4: Build**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard && go build ./...
```
Expected: clean. Fix any "declared and not used" errors for removed variables.

- [ ] **Step 5: Smoke test**

```bash
curl -s "http://localhost:8765/api/insights?days=30" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('tier:', d.get('tier'))
print('score:', d.get('score'))
print('output_ratio:', d.get('output_ratio'))
print('ownership_pct:', d.get('ownership_pct'))
print('ai_loading:', d.get('ai_loading'))
for dim in d.get('dimensions', []):
    print(f'  {dim[\"label\"]}: {dim[\"tier\"]} ({dim[\"value\"]})')
"
```
Expected: tier is one of Beginner/Intermediate/Advanced/Expert, each dimension has tier + value.

- [ ] **Step 6: Commit**

```bash
git add internal/api/handlers.go
git commit -m "feat: rewrite getInsights with output-ratio/ownership tiers and Haiku background trigger"
```

---

## Task 6: Dashboard widget — TasksPanel.jsx

**Files:**
- Create: `web/src/components/TasksPanel.jsx`

- [ ] **Step 1: Create the component**

```jsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STATUS_COLOR = {
  completed:   '#22c55e',
  in_progress: '#1A73E8',
  pending:     '#9baabf',
}

const STATUS_LABEL = {
  completed:   'Done',
  in_progress: 'Active',
  pending:     'Pending',
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#9baabf'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: color + '18', color, textTransform: 'uppercase', letterSpacing: 0.5,
      flexShrink: 0,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export default function TasksPanel() {
  const [data, setData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return null
  const { summary, projects } = data
  if (summary.total === 0) return null

  // Top in-progress tasks across all projects
  const activeTasks = projects
    .flatMap(p => p.tasks.filter(t => t.status === 'in_progress').map(t => ({ ...t, _proj: p.project_dir })))
    .slice(0, 3)

  // Completion ring
  const pct = summary.total > 0 ? Math.round(summary.completed / summary.total * 100) : 0
  const r = 26
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>Tasks</div>
          <div style={{ fontSize: 11, color: '#7b809a', marginTop: 2 }}>
            Across {projects.length} project{projects.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={() => navigate('/tasks')}
          style={{ fontSize: 11, fontWeight: 600, color: '#1A73E8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          View all →
        </button>
      </div>

      {/* Ring + counters */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <svg width={68} height={68} viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
          <circle cx={34} cy={34} r={r} fill="none" stroke="#f0f2f5" strokeWidth={6} />
          <circle cx={34} cy={34} r={r} fill="none" stroke="#22c55e" strokeWidth={6}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 34 34)" />
          <text x={34} y={31} textAnchor="middle" style={{ fontFamily: 'Figtree', fontSize: 14, fontWeight: 800, fill: '#344767' }}>{pct}%</text>
          <text x={34} y={44} textAnchor="middle" style={{ fontFamily: 'Figtree', fontSize: 8, fontWeight: 600, fill: '#9baabf' }}>DONE</text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Completed', count: summary.completed, color: '#22c55e' },
            { label: 'In progress', count: summary.in_progress, color: '#1A73E8' },
            { label: 'Pending', count: summary.pending, color: '#9baabf' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#7b809a', width: 74 }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#344767' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f0f2f5', marginBottom: 12 }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            In Progress
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeTasks.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A73E8', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#344767', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.subject}
                  </div>
                  <div style={{ fontSize: 10, color: '#9baabf', marginTop: 1 }}>
                    {t._proj.split('/').pop()}
                    {t.session_date && ` · ${t.session_date}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/TasksPanel.jsx
git commit -m "feat: add TasksPanel dashboard widget with completion ring and in-progress tasks"
```

---

## Task 7: Tasks full page

**Files:**
- Create: `web/src/pages/Tasks.jsx`

- [ ] **Step 1: Create Tasks.jsx**

```jsx
import React, { useEffect, useState } from 'react'

const STATUS_ORDER = { in_progress: 0, pending: 1, completed: 2 }
const STATUS_COLOR = { completed: '#22c55e', in_progress: '#1A73E8', pending: '#9baabf' }
const STATUS_LABEL = { completed: 'Done', in_progress: 'Active', pending: 'Pending' }
const ALL = 'all'

function shortProject(dir) {
  if (!dir || dir === 'unknown') return 'Unknown'
  const parts = dir.replace('/Users/', '').split('/')
  return parts[parts.length - 1] || dir
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#9baabf'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: color + '18', color, textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

function CompletionBar({ rate }) {
  return (
    <div style={{ height: 4, background: '#f0f2f5', borderRadius: 2, overflow: 'hidden', width: 60 }}>
      <div style={{ height: '100%', width: `${rate}%`, background: '#22c55e', borderRadius: 2 }} />
    </div>
  )
}

export default function Tasks() {
  const [data, setData] = useState(null)
  const [selectedProject, setSelectedProject] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return (
    <div style={{ padding: 40, color: '#7b809a', fontFamily: 'Figtree', fontSize: 14 }}>Loading tasks…</div>
  )

  const { summary, projects } = data

  // All tasks flat list filtered
  const allTasks = projects.flatMap(p =>
    p.tasks.map(t => ({ ...t, _proj: p.project_dir, _rate: p.completion_rate }))
  )

  const visibleTasks = allTasks
    .filter(t => selectedProject === ALL || t.project_dir === selectedProject)
    .filter(t => statusFilter === ALL || t.status === statusFilter)
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))

  return (
    <div style={{ padding: 24, fontFamily: 'Figtree', maxWidth: 900 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#344767' }}>Tasks</div>
        <div style={{ fontSize: 12, color: '#7b809a', marginTop: 2 }}>
          {summary.completed} completed · {summary.in_progress} in progress · {summary.pending} pending
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', count: summary.total, color: '#344767' },
          { label: 'Done', count: summary.completed, color: '#22c55e' },
          { label: 'Active', count: summary.in_progress, color: '#1A73E8' },
          { label: 'Pending', count: summary.pending, color: '#9baabf' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ background: color + '12', border: `1px solid ${color}25`, borderRadius: 12, padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'JetBrains Mono' }}>{count}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Project completion bars */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#344767', marginBottom: 14 }}>By Project</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map(p => (
            <div key={p.project_dir} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => setSelectedProject(selectedProject === p.project_dir ? ALL : p.project_dir)}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: selectedProject === p.project_dir ? '#1A73E8' : '#344767',
                width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
              }} title={p.project_dir}>
                {shortProject(p.project_dir)}
              </span>
              <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${p.completion_rate}%`, background: '#22c55e', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#344767', width: 34, textAlign: 'right' }}>
                {p.completion_rate}%
              </span>
              <span style={{ fontSize: 10, color: '#9baabf', width: 60, textAlign: 'right' }}>
                {p.completed}/{p.completed + p.in_progress + p.pending}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f0f2f5', borderRadius: 20, padding: '3px' }}>
          {[ALL, 'in_progress', 'completed', 'pending'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
              background: statusFilter === s ? '#1A73E8' : 'transparent',
              color: statusFilter === s ? '#fff' : '#7b809a',
            }}>
              {s === ALL ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {selectedProject !== ALL && (
          <button onClick={() => setSelectedProject(ALL)} style={{
            padding: '4px 12px', borderRadius: 16, border: '1px solid #1A73E8',
            fontSize: 11, fontWeight: 600, color: '#1A73E8', background: '#EBF3FF', cursor: 'pointer',
          }}>
            {shortProject(selectedProject)} ✕
          </button>
        )}
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleTasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9baabf', fontSize: 13 }}>No tasks match this filter</div>
        )}
        {visibleTasks.map((t, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: '14px 16px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
            borderLeft: `3px solid ${STATUS_COLOR[t.status] || '#f0f2f5'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#344767', marginBottom: 4 }}>{t.subject}</div>
                {t.description && (
                  <div style={{ fontSize: 11, color: '#7b809a', lineHeight: 1.5, marginBottom: 6 }}>{t.description}</div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#9baabf', background: '#f8f9fa', padding: '2px 8px', borderRadius: 8 }}>
                    {shortProject(t.project_dir)}
                  </span>
                  {t.session_date && (
                    <span style={{ fontSize: 10, color: '#9baabf' }}>{t.session_date}</span>
                  )}
                </div>
              </div>
              <StatusBadge status={t.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Tasks.jsx
git commit -m "feat: add Tasks full page with project bars, status filters, task list"
```

---

## Task 8: Wire Tasks into router + sidebar

**Files:**
- Modify: `web/src/App.jsx`
- Modify: `web/src/components/Sidebar.jsx`
- Modify: `web/src/pages/Dashboard.jsx`

- [ ] **Step 1: Add /tasks route to App.jsx**

In `web/src/App.jsx`, add the import:
```jsx
import Tasks from './pages/Tasks.jsx'
```

Add the route inside `<Routes>`:
```jsx
<Route path="/tasks" element={<Tasks />} />
```

- [ ] **Step 2: Add Tasks nav item to Sidebar.jsx**

In the `icons` object in `NavIcon`, add:
```jsx
tasks: (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
),
```

In the `navItems` array, add after Sessions:
```jsx
{ to: '/tasks', label: 'Tasks', icon: 'tasks' },
```

- [ ] **Step 3: Add TasksPanel to Dashboard.jsx**

In `web/src/pages/Dashboard.jsx`, add import:
```jsx
import TasksPanel from '../components/TasksPanel.jsx'
```

Find the right-column area (where PromptScore renders) and add TasksPanel below it:
```jsx
<TasksPanel />
```

The right column already has PromptScore and SystemInfoCard — add TasksPanel between them:
```jsx
<PromptScore days={currentDays || 30} />
<TasksPanel />
<SystemInfoCard />
```

- [ ] **Step 4: Build frontend**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard/web && npm run build 2>&1 | tail -10
```
Expected: `✓ built in ...ms`

- [ ] **Step 5: Rebuild Go binary**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard && go build -o ai-sessions .
```

- [ ] **Step 6: Commit**

```bash
git add web/src/App.jsx web/src/components/Sidebar.jsx web/src/pages/Dashboard.jsx
git commit -m "feat: add Tasks route, sidebar nav item, and TasksPanel widget to Dashboard"
```

---

## Task 9: Update PromptScore.jsx — tiers + AI analysis section

**Files:**
- Modify: `web/src/components/PromptScore.jsx`

- [ ] **Step 1: Replace PromptScore.jsx entirely**

```jsx
import React, { useEffect, useState } from 'react'

const TIER_COLOR = {
  Expert:       '#22c55e',
  Advanced:     '#1A73E8',
  Intermediate: '#f59e0b',
  Beginner:     '#ef4444',
}

const TIER_BG = {
  Expert:       '#F0FDF4',
  Advanced:     '#EBF3FF',
  Intermediate: '#FFF8E6',
  Beginner:     '#FEECEC',
}

const DIMENSION_COLORS = ['#22c55e', '#2563eb', '#f59e0b', '#8b5cf6']

const INSIGHT_STYLE = {
  warning: { icon: '⚠', iconBg: '#FFF3E0', iconColor: '#f59e0b' },
  error:   { icon: '✕', iconBg: '#FEECEC', iconColor: '#ef4444' },
  info:    { icon: 'ℹ', iconBg: '#EFF6FF', iconColor: '#2563eb' },
  success: { icon: '✓', iconBg: '#F0FDF4', iconColor: '#22c55e' },
}

const TIER_CRITERIA = {
  Expert:       'Output >3×  ·  Ownership >25%  ·  Specificity >60%  ·  Avg turns <12',
  Advanced:     'Output >2×  ·  Ownership >15%  ·  Specificity >40%  ·  Avg turns <20',
  Intermediate: 'Output >1×  ·  Ownership >8%   ·  Specificity >20%  ·  Avg turns <35',
  Beginner:     'Below Intermediate thresholds on one or more dimensions',
}

export default function PromptScore({ days = 30 }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiExpanded, setAiExpanded] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  function fetchInsights(refresh = false) {
    setLoading(!data) // only full-screen load on first fetch
    const url = `/api/insights?days=${days}${refresh ? '&refresh=1' : ''}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setRefreshing(false) })
      .catch(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { fetchInsights() }, [days])

  // Poll until AI analysis arrives (aiLoading = true means background job running)
  useEffect(() => {
    if (!data?.ai_loading) return
    const timer = setTimeout(() => fetchInsights(), 6000)
    return () => clearTimeout(timer)
  }, [data?.ai_loading])

  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ fontSize: 12, color: '#9baabf' }}>Computing insights…</span>
      </div>
    )
  }
  if (!data) return null

  const tier = data.tier || 'Beginner'
  const score = data.score || 25
  const tierColor = TIER_COLOR[tier] || '#9baabf'
  const tierBg = TIER_BG[tier] || '#f8f9fa'

  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  const actionCount = (data.insights || []).filter(i => i.type === 'warning' || i.type === 'error').length

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#344767' }}>✦ Prompt Insights</div>
          <div style={{ fontSize: 11, color: '#7b809a', marginTop: 2 }}>
            {data.total_sessions} sessions · last {days} days
          </div>
        </div>
        <span style={{
          background: tierBg, color: tierColor,
          fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 20,
          letterSpacing: 0.3,
        }}>
          {tier.toUpperCase()}
        </span>
      </div>

      {/* Score ring + dimensions */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={108} height={108} viewBox="0 0 108 108">
            <circle cx={54} cy={54} r={r} fill="none" stroke="#f0f2f5" strokeWidth={9} />
            <circle cx={54} cy={54} r={r} fill="none" stroke={tierColor} strokeWidth={9}
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 54 54)" />
            <text x={54} y={46} textAnchor="middle"
              style={{ fontFamily: 'Figtree', fontSize: 11, fontWeight: 700, fill: tierColor }}>{tier}</text>
            <text x={54} y={62} textAnchor="middle"
              style={{ fontFamily: 'Figtree', fontSize: 9, fontWeight: 600, fill: '#9baabf', letterSpacing: 0.5 }}>TIER</text>
          </svg>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {(data.dimensions || []).map((d, i) => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: '#7b809a' }}>{d.label}</span>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 700, color: DIMENSION_COLORS[i % 4] }}>{d.value}</span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                      background: TIER_COLOR[d.tier] + '18', color: TIER_COLOR[d.tier],
                    }}>{d.tier}</span>
                  </div>
                </div>
                <div style={{ height: 5, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${d.score}%`,
                    background: DIMENSION_COLORS[i % 4], borderRadius: 3,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier criteria */}
      <div style={{ background: tierBg, borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
        <span style={{ fontSize: 10, color: tierColor, fontWeight: 600 }}>
          {tier} criteria: </span>
        <span style={{ fontSize: 10, color: '#7b809a' }}>{TIER_CRITERIA[tier]}</span>
        {actionCount > 0 && (
          <span style={{ marginLeft: 8, background: '#FFF3E0', color: '#f59e0b', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>
            {actionCount} action{actionCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Raw metric pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <MetaPill label="Output ratio" value={`${data.output_ratio}×`} color="#2563eb" />
        <MetaPill label="Avg turns" value={data.avg_turns} color="#8b5cf6" />
        <MetaPill label="Specific" value={`${data.specific_pct}%`} color="#22c55e" />
        {data.high_ctx_sessions > 0 && (
          <MetaPill label="Long sessions" value={data.high_ctx_sessions} color="#ef4444" />
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f2f5', marginBottom: 16 }} />

      {/* Insight cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {(data.insights || []).map((item, i) => {
          const style = INSIGHT_STYLE[item.type] || INSIGHT_STYLE.info
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                width: 26, height: 26, borderRadius: 7, background: style.iconBg,
                color: style.iconColor, display: 'grid', placeItems: 'center',
                fontSize: 12, flexShrink: 0, fontWeight: 700,
              }}>{style.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#344767', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{item.title}</span>
                  {item.impact && (
                    <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{item.impact}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#7b809a', marginTop: 2, lineHeight: 1.4 }}>{item.text}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Analysis section */}
      <div style={{ borderTop: '1px solid #f0f2f5', paddingTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button
            onClick={() => setAiExpanded(x => !x)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#344767' }}>✦ AI Analysis</span>
            <span style={{ fontSize: 10, color: '#9baabf' }}>{aiExpanded ? '▲' : '▼'}</span>
          </button>
          <button
            onClick={() => { setRefreshing(true); fetchInsights(true) }}
            disabled={refreshing}
            style={{
              fontSize: 10, fontWeight: 600, color: refreshing ? '#9baabf' : '#1A73E8',
              background: 'none', border: 'none', cursor: refreshing ? 'default' : 'pointer',
            }}
          >
            {refreshing ? 'Analyzing…' : '↻ Refresh'}
          </button>
        </div>

        {aiExpanded && (
          <>
            {data.ai_loading && !data.ai_analysis && (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#9baabf', marginBottom: 4 }}>Haiku is analyzing your prompts…</div>
                <div style={{ fontSize: 10, color: '#c4cdd6' }}>This takes ~10 seconds. Refresh in a moment.</div>
              </div>
            )}

            {data.ai_analysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Tier justification */}
                {data.ai_analysis.tier_justification && (
                  <div style={{ fontSize: 11, color: '#7b809a', fontStyle: 'italic', lineHeight: 1.5, background: '#f8f9fa', borderRadius: 8, padding: '8px 12px' }}>
                    "{data.ai_analysis.tier_justification}"
                  </div>
                )}

                {/* Top improvements */}
                {(data.ai_analysis.top_improvements || []).map((imp, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, background: imp.impact === 'high' ? '#FFF3E0' : '#EFF6FF',
                      color: imp.impact === 'high' ? '#f59e0b' : '#2563eb',
                      display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#344767', marginBottom: 3 }}>{imp.pattern}</div>
                      {imp.example_fix && (
                        <div style={{ fontSize: 10, color: '#7b809a', fontFamily: 'JetBrains Mono', lineHeight: 1.5, background: '#f8f9fa', borderRadius: 6, padding: '4px 8px' }}>
                          {imp.example_fix}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Rewrite */}
                {data.ai_analysis.rewrite && (
                  <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9baabf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Example Rewrite</div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>BEFORE</div>
                      <div style={{ fontSize: 11, color: '#7b809a', fontFamily: 'JetBrains Mono', lineHeight: 1.5 }}>{data.ai_analysis.rewrite.original}</div>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', marginBottom: 3 }}>AFTER</div>
                      <div style={{ fontSize: 11, color: '#344767', fontFamily: 'JetBrains Mono', lineHeight: 1.5 }}>{data.ai_analysis.rewrite.improved}</div>
                    </div>
                    {data.ai_analysis.rewrite.why && (
                      <div style={{ fontSize: 10, color: '#9baabf', marginTop: 6, fontStyle: 'italic' }}>{data.ai_analysis.rewrite.why}</div>
                    )}
                  </div>
                )}

                {/* Strengths */}
                {(data.ai_analysis.strengths || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Strengths</div>
                    {data.ai_analysis.strengths.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ color: '#22c55e', fontSize: 11, marginTop: 1 }}>✓</span>
                        <span style={{ fontSize: 11, color: '#7b809a', lineHeight: 1.4 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Analysis timestamp */}
                {data.ai_analysis.analyzed_at && (
                  <div style={{ fontSize: 9, color: '#c4cdd6', textAlign: 'right' }}>
                    Analyzed {new Date(data.ai_analysis.analyzed_at).toLocaleString()} · {data.ai_analysis.prompt_count} prompts sampled
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MetaPill({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: color + '10', border: `1px solid ${color}20`,
      borderRadius: 20, padding: '3px 8px',
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono', color }}>{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/PromptScore.jsx
git commit -m "feat: update PromptScore with tier badges, per-dimension tier labels, and Haiku AI analysis section"
```

---

## Task 10: Full build + smoke test

**Files:** all

- [ ] **Step 1: Build frontend**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard/web && npm run build 2>&1 | tail -8
```
Expected: `✓ built in ...ms` with no errors.

- [ ] **Step 2: Build Go binary**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard && go build -o ai-sessions . 2>&1
```
Expected: clean.

- [ ] **Step 3: Restart server and test all three features**

```bash
pkill -f ai-sessions 2>/dev/null; sleep 1
./ai-sessions &
sleep 2
```

Test tasks:
```bash
curl -s http://localhost:8765/api/tasks | python3 -c "
import sys,json; d=json.load(sys.stdin)
s = d['summary']
print(f'Tasks: {s[\"total\"]} total, {s[\"completed\"]} done, {s[\"in_progress\"]} active, {s[\"pending\"]} pending')
print(f'Projects: {len(d[\"projects\"])}')
"
```

Test insights with new tiers:
```bash
curl -s "http://localhost:8765/api/insights?days=30" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('Tier:', d['tier'])
print('Score:', d['score'])
print('Output ratio:', d['output_ratio'])
print('Ownership %:', d['ownership_pct'])
print('AI loading:', d['ai_loading'])
for dim in d['dimensions']:
    print(f'  {dim[\"label\"]}: {dim[\"tier\"]} | {dim[\"value\"]}')
"
```

- [ ] **Step 4: Go tests**

```bash
cd /Users/arunkumar/Documents/Application/AI-Usage-Dashboard && go test ./... 2>&1
```
Expected: all pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete tasks panel + insights overhaul - tasks widget/page, output-ratio tiers, Haiku AI analysis"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Tasks widget on Dashboard (TasksPanel.jsx + `/api/tasks`)
- ✅ Tasks full page (Tasks.jsx + `/tasks` route + Sidebar nav)
- ✅ Cache metric replaced with Output ratio + Prompt ownership
- ✅ Beginner/Intermediate/Advanced/Expert tiers with criteria shown
- ✅ Weakest-link tier logic
- ✅ Haiku analysis: auto-on-load with 24h cache + Refresh button
- ✅ Before/after rewrite example from Haiku
- ✅ AI analysis section in PromptScore with expand/collapse + polling until loaded

**Placeholder scan:** No TBDs, all code is complete, all API shapes are defined.

**Type consistency:**
- `models.TaskItem` defined in Task 1, used in tasks.go Task 3
- `models.HaikuAnalysis` defined in Task 2, used in haiku.go Task 4 and handlers.go Task 5
- `models.InsightDimension.Tier` + `.Value` added in Task 2, populated in Task 5, rendered in Task 9
- `callHaiku(promptSamples []string)` defined in Task 4 Step 2 (corrected), called in Task 5
- `loadHaikuCache()` / `saveHaikuCache()` defined in Task 4, called in Task 5
