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
	"github.com/ai-sessions/ai-sessions/internal/adapters/copilot"
	"github.com/ai-sessions/ai-sessions/internal/models"
	"github.com/ai-sessions/ai-sessions/internal/store"
)

type Handler struct {
	Store          *store.Store
	Adapter        *claudecode.Adapter
	CopilotAdapter *copilot.Adapter
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
	// GitHub Copilot
	mux.HandleFunc("/api/copilot/stats", h.getCopilotStats)
	mux.HandleFunc("/api/copilot/sessions", h.getCopilotSessions)
	mux.HandleFunc("/api/copilot/sessions/", h.getCopilotSessionDetail)
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
	scoreMin, _ := strconv.Atoi(r.URL.Query().Get("score_min"))
	scoreMax, _ := strconv.Atoi(r.URL.Query().Get("score_max"))
	if scoreMax < 1 {
		scoreMax = 10
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
			// Score the prompt quality 1-10
			pair.PromptScore, pair.PromptTips = scorePrompt(pair)
			pairs = append(pairs, pair)
		}
	}

	// Sort newest first
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].Timestamp.After(pairs[j].Timestamp)
	})

	// Filter by score range
	if scoreMin > 0 || scoreMax < 10 {
		var filtered []models.ConversationPair
		for _, p := range pairs {
			if p.PromptScore >= scoreMin && p.PromptScore <= scoreMax {
				filtered = append(filtered, p)
			}
		}
		pairs = filtered
	}

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

	// ── Agent Delegation ─────────────────────────────────────────────────────
	// % of sessions that used the Agent tool (dispatching subagents).
	// This is the clearest signal of power-user Claude Code behaviour.
	agentSessions := 0
	for _, s := range sessions {
		if s.ToolCounts["Agent"] > 0 {
			agentSessions++
		}
	}
	agentUsagePct := float64(agentSessions) / float64(len(sessions)) * 100
	agentT := agentUsageTier(agentUsagePct)

	// ── Tool Diversity ────────────────────────────────────────────────────────
	// Average number of distinct tool types used per session.
	// Experts use Agent, Read, Write, Edit, Bash, Grep, Glob, WebSearch etc.
	var totalUniqTools float64
	for _, s := range sessions {
		totalUniqTools += float64(len(s.ToolCounts))
	}
	avgToolDiversity := totalUniqTools / float64(len(sessions))
	toolDivT := toolDiversityTier(avgToolDiversity)

	// ── Specificity ───────────────────────────────────────────────────────────
	specificCount := 0
	for _, s := range sessions {
		if isSpecificPrompt(s.FirstPrompt) {
			specificCount++
		}
	}
	specificPct := float64(specificCount) / float64(len(sessions)) * 100
	specificT := specificityTier(specificPct)

	// ── Context info (not scored — just shown as raw pills) ───────────────────
	var totalFreshInput, totalCacheRead int64
	var totalTurns int
	highCtxSessions := 0
	for _, s := range sessions {
		totalFreshInput += int64(s.TotalUsage.InputTokens)
		totalCacheRead += int64(s.TotalUsage.CacheReadInputTokens)
		totalTurns += s.UserTurns
		if s.UserTurns > 50 {
			highCtxSessions++
		}
	}
	ownershipPct := 0.0 // kept for JSON compat
	if totalFreshInput+totalCacheRead > 0 {
		ownershipPct = float64(totalFreshInput) / float64(totalFreshInput+totalCacheRead) * 100
	}
	cacheEffPct := 100 - ownershipPct
	avgTurns := float64(totalTurns) / float64(len(sessions))

	// ── Overall Tier (weakest link across 4 capability dimensions) ────────────
	tierScores := map[string]int{
		"output_ratio":     outputRatioT,
		"agent_delegation": agentT,
		"specificity":      specificT,
		"tool_diversity":   toolDivT,
	}
	minTier := outputRatioT
	weakestDim := "output_ratio"
	for dim, t := range tierScores {
		if t < minTier {
			minTier = t
			weakestDim = dim
		}
	}
	overallTier := tierName(minTier)
	overallScore := tierScore(overallTier)

	// ── Dimensions ────────────────────────────────────────────────────────────
	dimensions := []models.InsightDimension{
		{
			Label:       "Output ratio",
			Score:       tierToBarScore(tierName(outputRatioT)),
			Tier:        tierName(outputRatioT),
			Value:       fmt.Sprintf("%.1f×", outputRatio),
			Description: "Output tokens ÷ input tokens. Experts ask for complete implementations — Claude writes 3× more than you type.",
		},
		{
			Label:       "Agent delegation",
			Score:       tierToBarScore(tierName(agentT)),
			Tier:        tierName(agentT),
			Value:       fmt.Sprintf("%.0f%%", agentUsagePct),
			Description: "% of sessions where you dispatched a subagent. Using agents for complex tasks is the #1 sign of an expert Claude Code user.",
		},
		{
			Label:       "Prompt specificity",
			Score:       tierToBarScore(tierName(specificT)),
			Tier:        tierName(specificT),
			Value:       fmt.Sprintf("%.0f%%", specificPct),
			Description: "% of first prompts referencing exact files, functions, or line numbers. Specific prompts skip search overhead.",
		},
		{
			Label:       "Tool breadth",
			Score:       tierToBarScore(tierName(toolDivT)),
			Tier:        tierName(toolDivT),
			Value:       fmt.Sprintf("%.1f tools", avgToolDiversity),
			Description: "Average unique tools per session (Read, Write, Bash, Agent, Grep…). Experts use Claude Code's full toolbox.",
		},
	}

	// ── Insights come from Haiku AI analysis (populated below) ──────────────
	var insights []models.Insight

	// ── Next Tier Goals ───────────────────────────────────────────────────────
	nextT := minTier + 1
	if nextT > 3 {
		nextT = 3
	}
	var nextTierGoals []models.TierGoal

	// Output ratio goal
	outThresholds := []float64{1.0, 2.0, 3.0}
	outTarget := outThresholds[min3(nextT-1, 2)]
	nextTierGoals = append(nextTierGoals, models.TierGoal{
		Dimension:    "Output ratio",
		CurrentValue: fmt.Sprintf("%.1f×", outputRatio),
		TargetValue:  fmt.Sprintf("%.0f×+", outTarget),
		Delta:        fmt.Sprintf("+%.1f×", math.Max(0, outTarget-outputRatio)),
		CurrentTier:  tierName(outputRatioT),
		NextTier:     tierName(nextT),
		Met:          outputRatioT >= nextT,
		IsWeakest:    weakestDim == "output_ratio",
	})

	// Agent delegation goal
	agentThresholds := []float64{5.0, 15.0, 30.0}
	agentTarget := agentThresholds[min3(nextT-1, 2)]
	nextTierGoals = append(nextTierGoals, models.TierGoal{
		Dimension:    "Agent delegation",
		CurrentValue: fmt.Sprintf("%.0f%%", agentUsagePct),
		TargetValue:  fmt.Sprintf("%.0f%%+", agentTarget),
		Delta:        fmt.Sprintf("+%.0f%%", math.Max(0, agentTarget-agentUsagePct)),
		CurrentTier:  tierName(agentT),
		NextTier:     tierName(nextT),
		Met:          agentT >= nextT,
		IsWeakest:    weakestDim == "agent_delegation",
	})

	// Specificity goal
	specThresholds := []float64{20.0, 40.0, 60.0}
	specTarget := specThresholds[min3(nextT-1, 2)]
	nextTierGoals = append(nextTierGoals, models.TierGoal{
		Dimension:    "Prompt specificity",
		CurrentValue: fmt.Sprintf("%.0f%%", specificPct),
		TargetValue:  fmt.Sprintf("%.0f%%+", specTarget),
		Delta:        fmt.Sprintf("+%.0f%%", math.Max(0, specTarget-specificPct)),
		CurrentTier:  tierName(specificT),
		NextTier:     tierName(nextT),
		Met:          specificT >= nextT,
		IsWeakest:    weakestDim == "specificity",
	})

	// Tool diversity goal
	toolThresholds := []float64{3.0, 5.0, 7.0}
	toolTarget := toolThresholds[min3(nextT-1, 2)]
	nextTierGoals = append(nextTierGoals, models.TierGoal{
		Dimension:    "Tool breadth",
		CurrentValue: fmt.Sprintf("%.1f tools", avgToolDiversity),
		TargetValue:  fmt.Sprintf("%.0f+ tools", toolTarget),
		Delta:        fmt.Sprintf("+%.1f tools", math.Max(0, toolTarget-avgToolDiversity)),
		CurrentTier:  tierName(toolDivT),
		NextTier:     tierName(nextT),
		Met:          toolDivT >= nextT,
		IsWeakest:    weakestDim == "tool_diversity",
	})

	// ── Real Prompt Examples for unmet goals ─────────────────────────────────
	for i := range nextTierGoals {
		if nextTierGoals[i].Met {
			continue
		}
		var examples []models.PromptExample
		switch nextTierGoals[i].Dimension {
		case "Output ratio":
			for _, s := range sessions {
				if len(examples) >= 3 {
					break
				}
				p := strings.TrimSpace(s.FirstPrompt)
				if p == "" || len(p) > 150 || len(p) < 8 || strings.Contains(p, "[Image") || strings.Contains(p, "source:") || strings.Contains(p, "<local-command") || strings.Contains(p, "Caveat:") {
					continue
				}
				ratio := 0.0
				if s.TotalUsage.InputTokens > 0 {
					ratio = float64(s.TotalUsage.OutputTokens) / float64(s.TotalUsage.InputTokens)
				}
				if ratio < 1.0 && ratio > 0 {
					truncP := p
					if len(truncP) > 100 {
						truncP = truncP[:100] + "…"
					}
					examples = append(examples, models.PromptExample{
						Bad:  truncP,
						Good: fmt.Sprintf("Output ratio was %.1f× — Claude wrote less than you typed. Ask for complete implementations: \"implement this fully with error handling and tests\" instead of step-by-step guidance.", ratio),
						Why:  fmt.Sprintf("This session produced only %.1f× output per input token. Asking for full implementations in one go pushes the ratio above 2×.", ratio),
					})
				}
			}
		case "Prompt specificity":
			for _, s := range sessions {
				if len(examples) >= 3 {
					break
				}
				p := strings.TrimSpace(s.FirstPrompt)
				if p == "" || len(p) > 150 || len(p) < 8 || strings.Contains(p, "[Image") || strings.Contains(p, "source:") || strings.Contains(p, "<local-command") || strings.Contains(p, "Caveat:") {
					continue
				}
				if !isSpecificPrompt(p) {
					truncP := p
					if len(truncP) > 100 {
						truncP = truncP[:100] + "…"
					}
					// Find the most-used file in this session's tool samples
					hint := ""
					if samples, ok := s.ToolSamples["Read"]; ok && len(samples) > 0 {
						hint = samples[0]
					} else if samples, ok := s.ToolSamples["Edit"]; ok && len(samples) > 0 {
						hint = samples[0]
					}
					good := "Add the file path and function name to your prompt. "
					if hint != "" {
						good += fmt.Sprintf("Claude ended up reading \"%s\" — mention it upfront to skip the search.", hint)
					} else {
						good += "e.g. \"In src/components/Auth.tsx:42, fix the validation\" — Claude jumps straight there."
					}
					examples = append(examples, models.PromptExample{
						Bad:  truncP,
						Good: good,
						Why:  "Claude had to search for the right file first. Naming it upfront saves tokens and time.",
					})
				}
			}
		case "Agent delegation":
			for _, s := range sessions {
				if len(examples) >= 3 {
					break
				}
				if s.ToolCounts["Agent"] > 0 || s.UserTurns < 15 {
					continue
				}
				p := strings.TrimSpace(s.FirstPrompt)
				if p == "" || strings.Contains(p, "[Image") || strings.Contains(p, "source:") || strings.Contains(p, "<local-command") || strings.Contains(p, "Caveat:") {
					continue
				}
				truncP := p
				if len(truncP) > 100 {
					truncP = truncP[:100] + "…"
				}
				project := s.ProjectDir
				if idx := strings.LastIndex(project, "/"); idx >= 0 {
					project = project[idx+1:]
				}
				examples = append(examples, models.PromptExample{
					Bad:  fmt.Sprintf("\"%s\" — %d turns in %s, all done sequentially", truncP, s.UserTurns, project),
					Good: fmt.Sprintf("With %d turns, parts of this could run in parallel. Say: \"Use agents to handle X and Y concurrently\" or use the /parallel command for independent subtasks.", s.UserTurns),
					Why:  fmt.Sprintf("Long sequential sessions (%d turns) often contain independent subtasks. Agents can handle 2-3 tasks simultaneously.", s.UserTurns),
				})
			}
		case "Tool breadth":
			for _, s := range sessions {
				if len(examples) >= 3 {
					break
				}
				if len(s.ToolCounts) > 2 {
					continue
				}
				p := strings.TrimSpace(s.FirstPrompt)
				if p == "" || len(p) < 8 || strings.Contains(p, "[Image") || strings.Contains(p, "source:") || strings.Contains(p, "<local-command") || strings.Contains(p, "Caveat:") {
					continue
				}
				truncP := p
				if len(truncP) > 100 {
					truncP = truncP[:100] + "…"
				}
				usedTools := []string{}
				for t := range s.ToolCounts {
					usedTools = append(usedTools, t)
				}
				sort.Strings(usedTools)
				missing := []string{}
				allTools := []string{"Read", "Edit", "Grep", "Glob", "Bash", "Agent", "Write"}
				for _, t := range allTools {
					found := false
					for _, u := range usedTools {
						if t == u {
							found = true
							break
						}
					}
					if !found {
						missing = append(missing, t)
					}
				}
				if len(missing) > 4 {
					missing = missing[:4]
				}
				examples = append(examples, models.PromptExample{
					Bad:  fmt.Sprintf("\"%s\" — only used %s", truncP, strings.Join(usedTools, ", ")),
					Good: fmt.Sprintf("This session could also have used: %s. Ask Claude to search with Grep, inspect with Read, or delegate with Agent for richer results.", strings.Join(missing, ", ")),
					Why:  fmt.Sprintf("Using only %d tool(s) limits what Claude can do. Each tool is optimized for its job — Grep is faster than Bash grep, Edit is safer than sed.", len(usedTools)),
				})
			}
		}
		nextTierGoals[i].Examples = examples
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

	// Build top tools list for Haiku context
	type toolCount struct {
		name  string
		count int
	}
	// Build aggregate tool counts from the filtered session set
	aggregateTools := map[string]int{}
	for _, s := range sessions {
		for tool, cnt := range s.ToolCounts {
			aggregateTools[tool] += cnt
		}
	}
	var toolList []toolCount
	for name, cnt := range aggregateTools {
		toolList = append(toolList, toolCount{name, cnt})
	}
	sort.Slice(toolList, func(i, j int) bool { return toolList[i].count > toolList[j].count })
	var topToolStrs []string
	for i, tc := range toolList {
		if i >= 6 {
			break
		}
		topToolStrs = append(topToolStrs, fmt.Sprintf("%s:%d", tc.name, tc.count))
	}

	metricsCtx := MetricsContext{
		OutputRatio:      outputRatio,
		AgentUsagePct:    agentUsagePct,
		SpecificPct:      specificPct,
		AvgToolDiversity: avgToolDiversity,
		TopTools:         topToolStrs,
		OverallTier:      overallTier,
		TotalSessions:    len(sessions),
		HighCtxSessions:  highCtxSessions,
	}

	if aiAnalysis == nil {
		// Return immediately with aiLoading=true; trigger background analysis
		aiLoading = true
		prompts := samplePrompts(sessions, 15)
		go func() {
			analysis, err := callHaiku(prompts, metricsCtx)
			if err != nil {
				return
			}
			saveHaikuCache(&models.HaikuCache{
				Analysis:   analysis,
				AnalyzedAt: analysis.AnalyzedAt,
				PromptHash: promptHash(prompts),
			})
		}()
	} else {
		insights = aiAnalysis.Insights
	}

	writeJSON(w, models.InsightsResponse{
		Score:            overallScore,
		Tier:             overallTier,
		Dimensions:       dimensions,
		Insights:         insights,
		CachePct:         math.Round(cacheEffPct*10) / 10,
		AvgTurns:         math.Round(avgTurns*10) / 10,
		HighCtxSessions:  highCtxSessions,
		SpecificPct:      math.Round(specificPct*10) / 10,
		TotalSessions:    len(sessions),
		AvgPromptLen:     math.Round(avgPromptLen),
		OutputRatio:      math.Round(outputRatio*100) / 100,
		OwnershipPct:     math.Round(ownershipPct*10) / 10,
		AgentUsagePct:    math.Round(agentUsagePct*10) / 10,
		AvgToolDiversity: math.Round(avgToolDiversity*10) / 10,
		NextTierGoals:    nextTierGoals,
		AIAnalysis:       aiAnalysis,
		AILoading:        aiLoading,
	})
}

func min3(a, b int) int {
	if a < b {
		return a
	}
	return b
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

// scorePrompt rates a prompt using the CARE framework:
// C = Context (role/persona, project context, background)
// A = Ask (clear task/instruction with action verb)
// R = Rules (constraints, boundaries, what NOT to do)
// E = Examples (desired output format, examples, reference patterns)
// Scoring is strict: 1-3 = Weak, 4-5 = Needs Work, 6-7 = Decent, 8-9 = Good, 10 = Expert
// Only truly structured prompts score 8+.
func scorePrompt(pair models.ConversationPair) (int, []string) {
	text := strings.TrimSpace(pair.UserText)
	var tips []string

	// Empty or image-only prompt
	if text == "" {
		return 1, []string{"Empty prompt — describe what you want done."}
	}
	if strings.Contains(text, "[Image") && len(strings.ReplaceAll(strings.ReplaceAll(text, " ", ""), "\n", "")) < 30 {
		return 2, []string{
			"[C] Add context: what project/file is this about?",
			"[A] Describe the task: what should Claude do with this image?",
		}
	}

	lower := strings.ToLower(text)
	textLen := len(text)
	score := 1 // start low — earn your score

	// ── C: CONTEXT (0-2 points) ──────────────────────────────────────────────
	// Does the prompt set context? File paths, project names, role/persona
	hasContext := false

	// File/path references
	if isSpecificPrompt(text) {
		score += 1
		hasContext = true
	} else {
		tips = append(tips, "[C] Context: mention file paths, function names, or line numbers so Claude knows WHERE to work.")
	}

	// Role/persona or background context (longer prompts with setup)
	hasRole := false
	for _, kw := range []string{"as a ", "you are ", "act as ", "role:", "persona", "background:", "context:"} {
		if strings.Contains(lower, kw) {
			hasRole = true
			break
		}
	}
	if hasRole {
		score += 1
	} else if textLen > 50 {
		// Partial credit for providing some context via length
		if hasContext {
			score += 1
		}
	}

	// ── A: ASK / INSTRUCTION (0-3 points) ────────────────────────────────────
	// Clear task with action verb
	actionVerbs := []string{"fix", "add", "create", "update", "remove", "refactor", "implement", "write", "build", "change", "move", "rename", "test", "debug", "review", "check", "optimize", "migrate", "delete", "replace", "extract", "split", "merge", "convert"}
	hasAction := false
	for _, w := range actionVerbs {
		if strings.Contains(lower, w+" ") || strings.Contains(lower, w+"\n") || strings.HasPrefix(lower, w) {
			hasAction = true
			break
		}
	}
	if hasAction {
		score += 1
	} else {
		tips = append(tips, "[A] Ask: start with a clear action verb — fix, implement, add, refactor, create, etc.")
	}

	// Detailed instruction (not just a one-liner)
	if textLen >= 80 {
		score += 1
	} else if textLen < 30 {
		tips = append(tips, "[A] Ask: too brief — describe WHAT you want done and the expected behavior.")
	}

	// Multi-step or structured ask
	hasStructure := strings.Contains(text, "\n") || strings.Contains(text, "1.") || strings.Contains(text, "- ") || strings.Contains(text, "•")
	if hasStructure && textLen >= 100 {
		score += 1
	}

	// ── R: RULES / CONSTRAINTS (0-2 points) ──────────────────────────────────
	// Does the prompt set boundaries?
	hasConstraints := false
	for _, kw := range []string{"don't", "do not", "avoid", "must", "should", "only", "without", "ensure", "make sure", "never", "always", "constraint", "requirement", "rule:", "important:"} {
		if strings.Contains(lower, kw) {
			hasConstraints = true
			break
		}
	}
	if hasConstraints {
		score += 1
	} else {
		tips = append(tips, "[R] Rules: add constraints — what to avoid, boundaries, must-haves (e.g., \"don't change the API\", \"must be backward compatible\").")
	}

	// Expected behavior or acceptance criteria
	hasExpected := false
	for _, kw := range []string{"expect", "should return", "should output", "result should", "the output", "it should", "success criteria", "acceptance"} {
		if strings.Contains(lower, kw) {
			hasExpected = true
			break
		}
	}
	if hasExpected {
		score += 1
	}

	// ── E: EXAMPLES / OUTPUT FORMAT (0-2 points) ─────────────────────────────
	// Does the prompt specify desired output format or give examples?
	hasFormat := false
	for _, kw := range []string{"format:", "output:", "example:", "e.g.", "for example", "like this", "such as", "table", "list", "json", "csv", "markdown", "as a ", "return as", "respond with", "give me a"} {
		if strings.Contains(lower, kw) {
			hasFormat = true
			break
		}
	}
	if hasFormat {
		score += 1
	} else {
		tips = append(tips, "[E] Examples: specify the desired output format (list, table, code block) or give an example of what you expect.")
	}

	// Code examples or before/after patterns
	if strings.Contains(text, "```") || strings.Contains(text, "before:") || strings.Contains(text, "after:") || strings.Contains(text, "currently:") {
		score += 1
	}

	// ── Clamp 1-10 ───────────────────────────────────────────────────────────
	if score < 1 {
		score = 1
	}
	if score > 10 {
		score = 10
	}

	// Always show at least one tip unless score is 10
	if score < 10 && len(tips) == 0 {
		tips = append(tips, "Try the CARE format: [C]ontext → [A]sk → [R]ules → [E]xamples for maximum clarity.")
	}

	// Limit tips
	if len(tips) > 4 {
		tips = tips[:4]
	}

	return score, tips
}

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

// ownershipTier kept for reference but no longer used in scoring.
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

// cacheEfficiencyTier kept for reference — no longer used in scoring.
func cacheEfficiencyTier(pct float64) int {
	switch {
	case pct > 85:
		return 3
	case pct > 65:
		return 2
	case pct > 40:
		return 1
	default:
		return 0
	}
}

// agentUsageTier returns 0-3 tier for % of sessions using the Agent tool.
func agentUsageTier(pct float64) int {
	switch {
	case pct > 30:
		return 3 // Expert: delegates most complex tasks to subagents
	case pct > 15:
		return 2 // Advanced
	case pct > 5:
		return 1 // Intermediate
	default:
		return 0 // Beginner
	}
}

// toolDiversityTier returns 0-3 tier for average unique tools per session.
func toolDiversityTier(avg float64) int {
	switch {
	case avg > 7:
		return 3 // Expert: Agent, Read, Write, Edit, Bash, Grep, Glob, WebSearch…
	case avg > 5:
		return 2 // Advanced
	case avg > 3:
		return 1 // Intermediate
	default:
		return 0 // Beginner
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

// ── GitHub Copilot handlers ───────────────────────────────────────────────────

// getCopilotStats handles GET /api/copilot/stats -- same query params as /api/stats
func (h *Handler) getCopilotStats(w http.ResponseWriter, r *http.Request) {
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
			to = to.Add(24*time.Hour - time.Second)
		}
		writeJSON(w, h.Store.StatsForSourceRange("github-copilot", from, to))
		return
	}
	writeJSON(w, h.Store.StatsForSourceDays("github-copilot", days))
}

// getCopilotSessions handles GET /api/copilot/sessions -- same params as /api/sessions
func (h *Handler) getCopilotSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	sessions := h.Store.SessionsBySource("github-copilot")

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

// getCopilotSessionDetail handles GET /api/copilot/sessions/:id/turns
func (h *Handler) getCopilotSessionDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/copilot/sessions/"), "/")
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
	if sess.Source != "github-copilot" {
		http.Error(w, "not a copilot session", http.StatusBadRequest)
		return
	}

	turns, err := h.CopilotAdapter.ParseTurns(sess.FilePath)
	if err != nil {
		http.Error(w, "parse error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"session": sess,
		"turns":   turns,
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_ = json.NewEncoder(w).Encode(v)
}
