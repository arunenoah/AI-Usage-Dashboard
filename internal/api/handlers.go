package api

import (
	"bufio"
	"encoding/json"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/adapters/claudecode"
	"github.com/ai-sessions/ai-sessions/internal/models"
	"github.com/ai-sessions/ai-sessions/internal/store"
)

type Handler struct {
	Store   *store.Store
	Adapter *claudecode.Adapter
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/stats", h.getStats)
	mux.HandleFunc("/api/sessions", h.getSessions)
	mux.HandleFunc("/api/sessions/", h.getSessionDetail)
	mux.HandleFunc("/api/tools/", h.getToolSamples)
	mux.HandleFunc("/api/system", h.getSystemInfo)
	mux.HandleFunc("/api/history", h.getHistory)
	mux.HandleFunc("/api/conversations", h.getConversations)
	mux.HandleFunc("/api/image", h.serveImage)
	mux.HandleFunc("/api/health", h.health)
}

func (h *Handler) getStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))

	if fromStr != "" || toStr != "" {
		var from, to time.Time
		if fromStr != "" {
			from, _ = time.ParseInLocation("2006-01-02", fromStr, time.Local)
		}
		if toStr != "" {
			to, _ = time.ParseInLocation("2006-01-02", toStr, time.Local)
			to = to.Add(24*time.Hour - time.Second) // include the entire "to" day
		}
		writeJSON(w, h.Store.StatsForRange(from, to))
		return
	}
	writeJSON(w, h.Store.StatsForDays(days))
}

func (h *Handler) getSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	sessions := h.Store.Sessions()

	if project := r.URL.Query().Get("project"); project != "" {
		filtered := sessions[:0]
		for _, s := range sessions {
			if strings.Contains(s.ProjectDir, project) {
				filtered = append(filtered, s)
			}
		}
		sessions = filtered
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 500 {
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

// getSessionDetail handles GET /api/sessions/:id/turns
func (h *Handler) getSessionDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/sessions/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "session ID required", http.StatusBadRequest)
		return
	}
	sessionID := parts[0]

	sess := h.Store.Get(sessionID)
	if sess == nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	turns, err := h.Adapter.ParseTurns(sess.FilePath)
	if err != nil {
		http.Error(w, "parse error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"session": sess,
		"turns":   turns,
	})
}

// getToolSamples handles GET /api/tools/:name/samples
func (h *Handler) getToolSamples(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// /api/tools/<name>/samples
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/tools/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "tool name required", http.StatusBadRequest)
		return
	}
	toolName := parts[0]

	sessions := h.Store.Sessions()
	seen := make(map[string]bool)
	var samples []string
	var sessionRefs []map[string]any

	for _, sess := range sessions {
		if sampleList, ok := sess.ToolSamples[toolName]; ok {
			for _, s := range sampleList {
				if s != "" && !seen[s] {
					seen[s] = true
					samples = append(samples, s)
					sessionRefs = append(sessionRefs, map[string]any{
						"session_id":  sess.ID,
						"project":     sess.ProjectDir,
						"sample":      s,
						"timestamp":   sess.StartTime,
					})
				}
			}
		}
	}

	// Sort by most recent session
	total := h.Store.Stats().ToolCounts[toolName]

	writeJSON(w, map[string]any{
		"tool":    toolName,
		"total":   total,
		"samples": sessionRefs,
	})
}

// getHistory handles GET /api/history?days=N&limit=N
func (h *Handler) getHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 500 {
		limit = 50
	}

	home, _ := os.UserHomeDir()
	histPath := filepath.Join(home, ".claude", "history.jsonl")

	f, err := os.Open(histPath)
	if err != nil {
		writeJSON(w, map[string]any{"entries": []any{}, "total": 0})
		return
	}
	defer f.Close()

	var cutoff time.Time
	if days > 0 {
		cutoff = time.Now().Add(-time.Duration(days) * 24 * time.Hour)
	}

	var entries []models.HistoryEntry
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1*1024*1024), 1*1024*1024)
	for scanner.Scan() {
		var e models.HistoryEntry
		if err := json.Unmarshal(scanner.Bytes(), &e); err != nil {
			continue
		}
		if e.Display == "" {
			continue
		}
		if days > 0 {
			ts := time.Unix(e.Timestamp/1000, 0)
			if ts.Before(cutoff) {
				continue
			}
		}
		entries = append(entries, e)
	}

	// Sort newest first
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Timestamp > entries[j].Timestamp
	})

	total := len(entries)
	if len(entries) > limit {
		entries = entries[:limit]
	}

	writeJSON(w, map[string]any{
		"entries": entries,
		"total":   total,
	})
}

func (h *Handler) getSystemInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	home, _ := os.UserHomeDir()
	info := models.SystemInfo{}

	// settings.json
	settingsPath := filepath.Join(home, ".claude", "settings.json")
	if data, err := os.ReadFile(settingsPath); err == nil {
		var s struct {
			EnabledPlugins        map[string]bool `json:"enabledPlugins"`
			AlwaysThinkingEnabled bool            `json:"alwaysThinkingEnabled"`
		}
		if json.Unmarshal(data, &s) == nil {
			for k, v := range s.EnabledPlugins {
				if v {
					name := strings.SplitN(k, "@", 2)[0]
					info.EnabledPlugins = append(info.EnabledPlugins, name)
				}
			}
			info.AlwaysThinkingEnabled = s.AlwaysThinkingEnabled
		}
	}

	// mcp.json
	mcpPath := filepath.Join(home, ".claude", "mcp.json")
	if data, err := os.ReadFile(mcpPath); err == nil {
		var m struct {
			MCPServers map[string]any `json:"mcpServers"`
		}
		if json.Unmarshal(data, &m) == nil {
			for k := range m.MCPServers {
				info.MCPServers = append(info.MCPServers, k)
			}
		}
	}

	// Count session files and project dirs
	projectsDir := filepath.Join(home, ".claude", "projects")
	var sessionFiles, projectDirs int
	_ = filepath.Walk(projectsDir, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if fi.IsDir() && path != projectsDir {
			projectDirs++
		}
		if !fi.IsDir() && strings.HasSuffix(path, ".jsonl") {
			sessionFiles++
		}
		return nil
	})
	info.TotalSessionFiles = sessionFiles
	info.TotalProjectDirs = projectDirs

	// Count plans
	plansDir := filepath.Join(home, ".claude", "plans")
	if entries, err := os.ReadDir(plansDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".md") {
				info.PlanCount++
			}
		}
	}

	// Count tasks sessions
	tasksDir := filepath.Join(home, ".claude", "tasks")
	if entries, err := os.ReadDir(tasksDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				info.TaskCount++
			}
		}
	}

	// stats-cache.json
	statsCachePath := filepath.Join(home, ".claude", "stats-cache.json")
	if data, err := os.ReadFile(statsCachePath); err == nil {
		var sc struct {
			TotalMessages  int    `json:"totalMessages"`
			FirstSessionDate string `json:"firstSessionDate"`
			ModelUsage     map[string]struct {
				InputTokens              int64   `json:"inputTokens"`
				OutputTokens             int64   `json:"outputTokens"`
				CacheReadInputTokens     int64   `json:"cacheReadInputTokens"`
				CacheCreationInputTokens int64   `json:"cacheCreationInputTokens"`
			} `json:"modelUsage"`
		}
		if json.Unmarshal(data, &sc) == nil {
			info.TotalMessagesAllTime = sc.TotalMessages
			if sc.FirstSessionDate != "" && len(sc.FirstSessionDate) >= 10 {
				info.FirstSessionDate = sc.FirstSessionDate[:10]
			}
			const (
				priceInput    = 3.0
				priceOutput   = 15.0
				priceCacheR   = 0.30
				priceCacheW   = 3.75
			)
			for model, mu := range sc.ModelUsage {
				cost := float64(mu.InputTokens)/1e6*priceInput +
					float64(mu.OutputTokens)/1e6*priceOutput +
					float64(mu.CacheReadInputTokens)/1e6*priceCacheR +
					float64(mu.CacheCreationInputTokens)/1e6*priceCacheW
				info.ModelUsage = append(info.ModelUsage, models.ModelStats{
					Model:                    model,
					InputTokens:              mu.InputTokens,
					OutputTokens:             mu.OutputTokens,
					CacheReadInputTokens:     mu.CacheReadInputTokens,
					CacheCreationInputTokens: mu.CacheCreationInputTokens,
					EstCostUSD:               math.Round(cost*100) / 100,
				})
			}
			sort.Slice(info.ModelUsage, func(i, j int) bool {
				return info.ModelUsage[i].EstCostUSD > info.ModelUsage[j].EstCostUSD
			})
		}
	}

	// paste-cache count
	pasteCacheDir := filepath.Join(home, ".claude", "paste-cache")
	if entries, err := os.ReadDir(pasteCacheDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				info.PasteCacheCount++
			}
		}
	}

	// file-history count (unique hashes across all sessions)
	fileHistoryDir := filepath.Join(home, ".claude", "file-history")
	fileHistSet := make(map[string]bool)
	_ = filepath.Walk(fileHistoryDir, func(path string, fi os.FileInfo, err error) error {
		if err != nil || fi.IsDir() {
			return nil
		}
		// Extract hash part (before @v)
		base := filepath.Base(path)
		if idx := strings.Index(base, "@"); idx > 0 {
			fileHistSet[base[:idx]] = true
		}
		return nil
	})
	info.FileHistoryCount = len(fileHistSet)

	// todos: scan all todo files, collect recent non-empty completed/pending
	todosDir := filepath.Join(home, ".claude", "todos")
	type rawTodo struct {
		Content string `json:"content"`
		Status  string `json:"status"`
	}
	if entries, err := os.ReadDir(todosDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(todosDir, e.Name()))
			if err != nil {
				continue
			}
			var todos []rawTodo
			if json.Unmarshal(data, &todos) != nil {
				continue
			}
			// Extract session ID from filename (before first -)
			sessionID := strings.Split(e.Name(), "-agent-")[0]
			for _, t := range todos {
				if t.Content == "" {
					continue
				}
				if t.Status == "completed" {
					info.TodosCompleted++
				} else {
					info.TodosPending++
				}
				if len(info.RecentTodos) < 10 {
					info.RecentTodos = append(info.RecentTodos, models.TodoItem{
						Content:   t.Content,
						Status:    t.Status,
						SessionID: sessionID,
					})
				}
			}
		}
	}

	writeJSON(w, info)
}

// getConversations returns user→assistant turn pairs filtered by period
// GET /api/conversations?period=today|week|month|all&limit=N
func (h *Handler) getConversations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	period := r.URL.Query().Get("period")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 500 {
		limit = 80
	}

	var cutoff time.Time
	now := time.Now()
	switch period {
	case "today":
		cutoff = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	case "week":
		cutoff = now.AddDate(0, 0, -7)
	case "month":
		cutoff = now.AddDate(0, 0, -30)
	case "all":
		// cutoff stays zero — include all sessions
	default:
		cutoff = now.AddDate(0, 0, -7)
	}

	sessions := h.Store.Sessions()

	const contextWindow = 200_000.0
	const (
		priceInput  = 3.0
		priceOutput = 15.0
		priceCacheR = 0.30
		priceCacheW = 3.75
	)

	var pairs []models.ConversationPair

	for _, sess := range sessions {
		if sess.StartTime.Before(cutoff) {
			continue
		}
		turns, err := h.Adapter.ParseTurnsFull(sess.FilePath)
		if err != nil {
			continue
		}

		// Walk turns and build user→assistant pairs
		for i := 0; i < len(turns); i++ {
			if turns[i].Role != "user" {
				continue
			}
			userTurn := turns[i]
			if userTurn.Text == "" {
				continue
			}
			// Skip skill/system injections — not real user prompts
			if isSystemInjection(userTurn.Text) {
				continue
			}

			// Collect ALL assistant turns until the next user turn.
			// Claude does multiple agentic cycles (think→tool→tool→respond),
			// so we want the final assistant turn that has actual text,
			// and accumulate tool calls and usage across all cycles.
			var assistTurn *models.TurnEntry
			var allToolCalls []string
			// Accumulate real tokens: sum fresh input+output, but use LAST turn's cache snapshot for context %
			var sumInput, sumOutput, sumCacheWrite int
			var lastCacheRead int // cache_read from the final assistant turn = context depth at end
			var maxDurationMs int64
			lastJ := i
			for j := i + 1; j < len(turns); j++ {
				if turns[j].Role == "user" {
					break
				}
				if turns[j].Role == "assistant" {
					lastJ = j
					t := turns[j]
					allToolCalls = append(allToolCalls, t.ToolCalls...)
					if t.Usage != nil {
						sumInput += t.Usage.InputTokens
						sumOutput += t.Usage.OutputTokens
						sumCacheWrite += t.Usage.CacheCreationInputTokens
						lastCacheRead = t.Usage.CacheReadInputTokens // keep updating — last value is context depth
					}
					if t.DurationMs > maxDurationMs {
						maxDurationMs = t.DurationMs
					}
					if t.Text != "" && !strings.HasPrefix(t.Text, "[thinking]") {
						assistTurn = &t
					} else if assistTurn == nil {
						assistTurn = &t
					}
				}
			}
			i = lastJ

			pair := models.ConversationPair{
				SessionID:  sess.ID,
				ProjectDir: sess.ProjectDir,
				GitBranch:  sess.GitBranch,
				Model:      sess.Model,
				UserText:   userTurn.Text,
				Timestamp:  userTurn.Timestamp,
				ToolCalls:  allToolCalls,
				DurationMs: maxDurationMs,
			}
			if assistTurn != nil {
				pair.AssistText = assistTurn.Text
				if assistTurn.Model != "" {
					pair.Model = assistTurn.Model
				}
			}
			// Build usage: sum fresh tokens, use last turn's cache snapshot for context%
			if sumInput+sumOutput > 0 {
				u := models.Usage{
					InputTokens:              sumInput,
					OutputTokens:             sumOutput,
					CacheReadInputTokens:     lastCacheRead,
					CacheCreationInputTokens: sumCacheWrite,
				}
				pair.Usage = &u
				// Context% = (last cache_read + last input) / window — shows depth at end of response
				ctx := float64(lastCacheRead + sumInput)
				pair.ContextPct = math.Round(ctx/contextWindow*100*10) / 10
				// Cost: sum of fresh tokens + sum of cache writes + last cache_read (best approximation)
				pair.Cost = float64(sumInput)/1e6*priceInput +
					float64(sumOutput)/1e6*priceOutput +
					float64(lastCacheRead)/1e6*priceCacheR +
					float64(sumCacheWrite)/1e6*priceCacheW
				pair.Cost = math.Round(pair.Cost*10000) / 10000
			}
			pairs = append(pairs, pair)
		}

		if len(pairs) >= limit*3 { // over-collect then trim
			break
		}
	}

	// Sort newest first
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].Timestamp.After(pairs[j].Timestamp)
	})

	total := len(pairs)
	if len(pairs) > limit {
		pairs = pairs[:limit]
	}

	writeJSON(w, map[string]any{
		"pairs":  pairs,
		"total":  total,
		"period": period,
	})
}

// isSystemInjection detects noise/system messages that shouldn't appear in the conversation view
func isSystemInjection(text string) bool {
	if len(text) < 3 {
		return true
	}
	// Claude Code interruption messages
	noiseExact := []string{
		"[Request interrupted by user for tool use]",
		"[Request interrupted by user]",
		"[Interrupted by user]",
	}
	trimmed := strings.TrimSpace(text)
	for _, n := range noiseExact {
		if trimmed == n {
			return true
		}
	}
	// Very long markdown-formatted messages are usually skill context injections
	if len(text) > 1500 && (strings.HasPrefix(text, "#") || strings.HasPrefix(text, "You are")) {
		return true
	}
	prefixes := []string{
		"Base directory for this skill:",
		"# Spec Compliance",
		"# Code Quality",
		"# Implementer",
		"You are implementing Task",
		"You are reviewing whether",
		"Task tool (general-purpose)",
		"Task tool (superpowers:",
		"Use this template when",
		"[INST]",
	}
	for _, p := range prefixes {
		if strings.HasPrefix(text, p) {
			return true
		}
	}
	return false
}

// serveImage serves local image files from ~/.claude/image-cache/
func (h *Handler) serveImage(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path required", http.StatusBadRequest)
		return
	}
	home, _ := os.UserHomeDir()
	allowedPrefix := filepath.Join(home, ".claude", "image-cache")
	clean := filepath.Clean(path)
	if !strings.HasPrefix(clean, allowedPrefix) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(w, r, clean)
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_ = json.NewEncoder(w).Encode(v)
}
