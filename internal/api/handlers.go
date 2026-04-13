package api

import (
	"bufio"
	"encoding/json"
	"fmt"
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
	mux.HandleFunc("/api/insights", h.getInsights)
	mux.HandleFunc("/api/image", h.serveImage)
	mux.HandleFunc("/api/health", h.health)
	mux.HandleFunc("/api/tasks", h.getTasks)
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
	if limit < 1 || limit > 5000 {
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
	if limit < 1 || limit > 10000 {
		limit = 500
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
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
			var allToolDetails []models.ToolDetail
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
					allToolDetails = append(allToolDetails, t.ToolDetails...)
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
				SessionID:   sess.ID,
				ProjectDir:  sess.ProjectDir,
				GitBranch:   sess.GitBranch,
				Model:       sess.Model,
				UserText:    userTurn.Text,
				Timestamp:   userTurn.Timestamp,
				ToolCalls:   allToolCalls,
				ToolDetails: allToolDetails,
				DurationMs:  maxDurationMs,
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
	}

	// Sort newest first
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].Timestamp.After(pairs[j].Timestamp)
	})

	total := len(pairs)

	// Server-side pagination
	start := (page - 1) * limit
	if start >= total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}

	writeJSON(w, map[string]any{
		"pairs":       pairs[start:end],
		"total":       total,
		"period":      period,
		"page":        page,
		"total_pages": (total + limit - 1) / limit,
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
		// Claude Code XML-tagged command/tool outputs
		"<command-message>",
		"<command-name>",
		"<local-command-",
		"<local-command-caveat>",
	}
	for _, p := range prefixes {
		if strings.HasPrefix(trimmed, p) {
			return true
		}
	}
	return false
}

// getInsights computes real prompt quality metrics from session data
// GET /api/insights?days=30
func (h *Handler) getInsights(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 {
		days = 30
	}

	allSessions := h.Store.Sessions()
	cutoff := time.Now().AddDate(0, 0, -days)
	var sessions []*models.Session
	for _, s := range allSessions {
		if s.StartTime.After(cutoff) {
			sessions = append(sessions, s)
		}
	}
	if len(sessions) == 0 {
		sessions = allSessions // fallback to all if nothing recent
	}
	if len(sessions) == 0 {
		writeJSON(w, models.InsightsResponse{Score: 50})
		return
	}

	// ── Specificity ──────────────────────────────────────────────────────
	// % of first prompts that reference specific files, paths, or code
	specificCount := 0
	for _, s := range sessions {
		if isSpecificPrompt(s.FirstPrompt) {
			specificCount++
		}
	}
	specificPct := float64(specificCount) / float64(len(sessions)) * 100
	specificScore := clampScore(int(specificPct))

	// ── Cache Hit ────────────────────────────────────────────────────────
	var totalCacheRead, totalFreshInput int64
	for _, s := range sessions {
		totalCacheRead += int64(s.TotalUsage.CacheReadInputTokens)
		totalFreshInput += int64(s.TotalUsage.InputTokens)
	}
	cachePct := 0.0
	if totalCacheRead+totalFreshInput > 0 {
		cachePct = float64(totalCacheRead) / float64(totalCacheRead+totalFreshInput) * 100
	}
	cacheScore := clampScore(int(cachePct))

	// ── Conciseness ──────────────────────────────────────────────────────
	// Shorter avg first-prompt = more concise (good) — score degrades with length
	var totalLen int
	for _, s := range sessions {
		totalLen += len(s.FirstPrompt)
	}
	avgPromptLen := float64(totalLen) / float64(len(sessions))
	concisenessScore := promptLenToScore(avgPromptLen)

	// ── Session Hygiene ──────────────────────────────────────────────────
	// % sessions with < 30 user turns (good sessions don't balloon endlessly)
	goodTurns := 0
	var totalTurns int
	highCtxSessions := 0
	for _, s := range sessions {
		totalTurns += s.UserTurns
		if s.UserTurns < 30 {
			goodTurns++
		}
		if s.UserTurns > 50 {
			highCtxSessions++
		}
	}
	avgTurns := float64(totalTurns) / float64(len(sessions))
	hygieneScore := clampScore(int(float64(goodTurns) / float64(len(sessions)) * 100))

	// ── Overall Score ────────────────────────────────────────────────────
	// Weighted: cache (35%) + hygiene (25%) + specificity (25%) + conciseness (15%)
	overallScore := int(float64(cacheScore)*0.35 + float64(hygieneScore)*0.25 +
		float64(specificScore)*0.25 + float64(concisenessScore)*0.15)
	overallScore = clampScore(overallScore)

	// ── Dimensions ───────────────────────────────────────────────────────
	dimensions := []models.InsightDimension{
		{Label: "Specificity", Score: specificScore},
		{Label: "Cache hit", Score: cacheScore},
		{Label: "Conciseness", Score: concisenessScore},
		{Label: "Sess. hygiene", Score: hygieneScore},
	}

	// ── Dynamic Insights ─────────────────────────────────────────────────
	var insights []models.Insight

	// Cache insight
	if cachePct < 50 {
		// Estimate monthly savings if cache improved to 80%
		estMonthlyCost := float64(totalFreshInput) / 1e6 * 3.0 * (30.0 / float64(days))
		savingsEst := estMonthlyCost * ((80 - cachePct) / 100)
		insights = append(insights, models.Insight{
			Type:   "warning",
			Title:  "Cache Hit Below Optimal",
			Text:   fmt.Sprintf("%.0f%% cache hit rate — can reach 80%%+ by keeping system prompts stable between sessions.", cachePct),
			Impact: fmt.Sprintf("-$%.2f/mo", savingsEst),
		})
	} else if cachePct < 70 {
		insights = append(insights, models.Insight{
			Type:  "info",
			Title: "Cache Hit Moderate",
			Text:  fmt.Sprintf("%.0f%% cache hit rate. Improve by reusing the same working directory and keeping CLAUDE.md stable.", cachePct),
		})
	} else {
		insights = append(insights, models.Insight{
			Type:  "success",
			Title: "Excellent Cache Efficiency",
			Text:  fmt.Sprintf("%.0f%% of tokens served from cache — great job keeping context stable.", cachePct),
		})
	}

	// Long sessions insight
	if highCtxSessions > 0 {
		insights = append(insights, models.Insight{
			Type:  "warning",
			Title: "Long Sessions Detected",
			Text:  fmt.Sprintf("%d session%s exceeded 50 turns. Use /clear between unrelated tasks to avoid context bloat.", highCtxSessions, pluralS(highCtxSessions)),
		})
	} else if avgTurns > 20 {
		insights = append(insights, models.Insight{
			Type:  "info",
			Title: "Session Length Normal",
			Text:  fmt.Sprintf("Average %.0f turns/session. Consider /clear when switching between unrelated tasks.", avgTurns),
		})
	} else {
		insights = append(insights, models.Insight{
			Type:  "success",
			Title: "Session Hygiene Good",
			Text:  fmt.Sprintf("Average %.0f turns/session — sessions are staying focused and lean.", avgTurns),
		})
	}

	// Specificity insight
	if specificPct < 40 {
		insights = append(insights, models.Insight{
			Type:  "info",
			Title: "Low Prompt Specificity",
			Text:  fmt.Sprintf("Only %.0f%% of prompts reference specific files or code. Including file paths reduces search overhead.", specificPct),
		})
	} else {
		insights = append(insights, models.Insight{
			Type:  "success",
			Title: "Specificity Strong",
			Text:  fmt.Sprintf("%.0f%% of prompts reference specific files or code — this reduces unnecessary search tool calls.", specificPct),
		})
	}

	// Conciseness insight
	if avgPromptLen > 500 {
		insights = append(insights, models.Insight{
			Type:  "info",
			Title: "Prompts Are Verbose",
			Text:  fmt.Sprintf("Average first prompt is %.0f chars. Shorter, targeted prompts often get faster, more accurate responses.", avgPromptLen),
		})
	}

	writeJSON(w, models.InsightsResponse{
		Score:           overallScore,
		Dimensions:      dimensions,
		Insights:        insights,
		CachePct:        math.Round(cachePct*10) / 10,
		AvgTurns:        math.Round(avgTurns*10) / 10,
		HighCtxSessions: highCtxSessions,
		SpecificPct:     math.Round(specificPct*10) / 10,
		TotalSessions:   len(sessions),
		AvgPromptLen:    math.Round(avgPromptLen),
	})
}

// isSpecificPrompt returns true if the prompt references specific code artifacts
func isSpecificPrompt(text string) bool {
	if text == "" {
		return false
	}
	lower := strings.ToLower(text)
	// File extensions
	for _, ext := range []string{".go", ".js", ".ts", ".tsx", ".jsx", ".py", ".rb", ".php", ".rs", ".java", ".cs", ".cpp", ".c", ".sh", ".yaml", ".yml", ".json", ".sql", ".md"} {
		if strings.Contains(lower, ext) {
			return true
		}
	}
	// Path-like patterns (at least one /)
	if strings.Contains(text, "/") {
		return true
	}
	// Code keywords
	for _, kw := range []string{"func ", "function ", "class ", "interface ", "struct ", "const ", "import ", "export ", "line "} {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

func clampScore(v int) int {
	if v < 1 {
		return 1
	}
	if v > 99 {
		return 99
	}
	return v
}

func promptLenToScore(avgLen float64) int {
	switch {
	case avgLen <= 60:
		return 95
	case avgLen <= 120:
		return 85
	case avgLen <= 250:
		return 75
	case avgLen <= 450:
		return 60
	case avgLen <= 700:
		return 45
	default:
		return 30
	}
}

func pluralS(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
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
