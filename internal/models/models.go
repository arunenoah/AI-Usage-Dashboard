package models

import "time"

// InsightDimension is one scored dimension in the prompt quality breakdown
type InsightDimension struct {
	Label string `json:"label"`
	Score int    `json:"score"`
}

// Insight is one actionable finding
type Insight struct {
	Type   string `json:"type"`   // "warning" | "info" | "success" | "error"
	Title  string `json:"title"`
	Text   string `json:"text"`
	Impact string `json:"impact,omitempty"`
}

// InsightsResponse is the full response for /api/insights
type InsightsResponse struct {
	Score      int                `json:"score"`
	Dimensions []InsightDimension `json:"dimensions"`
	Insights   []Insight          `json:"insights"`
	// Raw metrics (for tooltips / detail)
	CachePct        float64 `json:"cache_pct"`
	AvgTurns        float64 `json:"avg_turns"`
	HighCtxSessions int     `json:"high_ctx_sessions"`
	SpecificPct     float64 `json:"specific_pct"`
	TotalSessions   int     `json:"total_sessions"`
	AvgPromptLen    float64 `json:"avg_prompt_len"`
}

// RawEntry is one line from a Claude Code JSONL session file
type RawEntry struct {
	Type       string      `json:"type"`
	Subtype    string      `json:"subtype,omitempty"`
	UUID       string      `json:"uuid"`
	Timestamp  time.Time   `json:"timestamp"`
	Message    *RawMessage `json:"message,omitempty"`
	DurationMs int64       `json:"durationMs,omitempty"`
	GitBranch  string      `json:"gitBranch,omitempty"`
}

// RawMessage is the message payload inside an assistant entry
type RawMessage struct {
	Role    string       `json:"role"`
	Model   string       `json:"model,omitempty"`
	Content []RawContent `json:"content"`
	Usage   *Usage       `json:"usage,omitempty"`
}

// RawContent is one content block (text or tool_use)
type RawContent struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	Thinking string `json:"thinking,omitempty"`
	Name     string `json:"name,omitempty"` // tool name when type=tool_use
	Input    any    `json:"input,omitempty"`
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
	ID                string              `json:"id"`
	FilePath          string              `json:"file_path"`
	ProjectDir        string              `json:"project_dir"`
	GitBranch         string              `json:"git_branch"`
	Model             string              `json:"model"`
	StartTime         time.Time           `json:"start_time"`
	EndTime           time.Time           `json:"end_time"`
	UserTurns         int                 `json:"user_turns"`
	AssistTurns       int                 `json:"assist_turns"`
	TotalUsage        Usage               `json:"total_usage"`
	ToolCounts        map[string]int      `json:"tool_counts"`
	ToolSamples       map[string][]string `json:"tool_samples,omitempty"` // tool → up to 5 sample inputs
	FirstPrompt       string              `json:"first_prompt"`
	Source            string              `json:"source"` // "claude-code"
	MaxTurnDurationMs int64               `json:"max_turn_duration_ms"`
	AvgTurnDurationMs int64               `json:"avg_turn_duration_ms"`
}

// HistoryEntry is one line from ~/.claude/history.jsonl
type HistoryEntry struct {
	Display   string `json:"display"`
	Timestamp int64  `json:"timestamp"`
	Project   string `json:"project"`
}

// ConversationPair is a matched user→assistant turn pair
type ConversationPair struct {
	SessionID  string    `json:"session_id"`
	ProjectDir string    `json:"project_dir"`
	GitBranch  string    `json:"git_branch"`
	Model      string    `json:"model"`
	UserText   string    `json:"user_text"`
	AssistText string    `json:"assist_text"`
	ToolCalls  []string  `json:"tool_calls,omitempty"`
	Usage      *Usage    `json:"usage,omitempty"`
	DurationMs int64     `json:"duration_ms,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
	ContextPct float64   `json:"context_pct"` // (input+cache_read)/200k*100
	Cost       float64   `json:"cost"`
}

// ModelStats holds token usage for one model
type ModelStats struct {
	Model                    string  `json:"model"`
	InputTokens              int64   `json:"input_tokens"`
	OutputTokens             int64   `json:"output_tokens"`
	CacheReadInputTokens     int64   `json:"cache_read_input_tokens"`
	CacheCreationInputTokens int64   `json:"cache_creation_input_tokens"`
	EstCostUSD               float64 `json:"est_cost_usd"`
}

// TodoItem is one task from ~/.claude/todos/*.json
type TodoItem struct {
	Content   string `json:"content"`
	Status    string `json:"status"`
	SessionID string `json:"session_id"`
}

// TurnEntry is one turn in a session (user or assistant)
type TurnEntry struct {
	Role       string            `json:"role"`
	Text       string            `json:"text"`       // user message or assistant text (truncated 500 chars)
	ToolCalls  []string          `json:"tool_calls"` // tool names used
	ToolInputs map[string]string `json:"tool_inputs,omitempty"` // tool name → key input param (file path, command, etc.)
	Usage      *Usage            `json:"usage,omitempty"`
	DurationMs int64             `json:"duration_ms,omitempty"`
	Model      string            `json:"model,omitempty"`
	Timestamp  time.Time         `json:"timestamp"`
}

// DailyStats aggregates token/cost data per day
type DailyStats struct {
	Date          string  `json:"date"` // "2006-01-02"
	InputTokens   int     `json:"input_tokens"`
	OutputTokens  int     `json:"output_tokens"`
	CacheRead     int64   `json:"cache_read"`
	CacheCreation int     `json:"cache_creation"`
	Sessions      int     `json:"sessions"`
	EstCostUSD    float64 `json:"est_cost_usd"`
}

// Stats is the top-level aggregated response for the dashboard
type Stats struct {
	TotalSessions            int            `json:"total_sessions"`
	TotalAllSessions         int            `json:"total_all_sessions"` // unfiltered total
	TotalInputTokens         int            `json:"total_input_tokens"`
	TotalOutputTokens        int            `json:"total_output_tokens"`
	TotalCacheReadTokens     int64          `json:"total_cache_read_tokens"`
	TotalCacheCreationTokens int            `json:"total_cache_creation_tokens"`
	TotalCostUSD             float64        `json:"total_cost_usd"`
	AvgSessionCostUSD        float64        `json:"avg_session_cost_usd"`
	AvgSessionTokens         int            `json:"avg_session_tokens"`
	Daily                    []DailyStats   `json:"daily"`
	ToolCounts               map[string]int `json:"tool_counts"`
	ActiveSession            *Session       `json:"active_session,omitempty"`
	Projects                 []string       `json:"projects"`
}

// SystemInfo holds metadata read from ~/.claude/
type SystemInfo struct {
	EnabledPlugins        []string     `json:"enabled_plugins"`
	MCPServers            []string     `json:"mcp_servers"`
	AlwaysThinkingEnabled bool         `json:"always_thinking_enabled"`
	TotalSessionFiles     int          `json:"total_session_files"`
	TotalProjectDirs      int          `json:"total_project_dirs"`
	PlanCount             int          `json:"plan_count"`
	TaskCount             int          `json:"task_count"`
	// Stats from stats-cache.json
	TotalMessagesAllTime  int          `json:"total_messages_all_time"`
	FirstSessionDate      string       `json:"first_session_date"`
	ModelUsage            []ModelStats `json:"model_usage"`
	// Files & todos
	PasteCacheCount       int          `json:"paste_cache_count"`
	FileHistoryCount      int          `json:"file_history_count"`
	TodosCompleted        int          `json:"todos_completed"`
	TodosPending          int          `json:"todos_pending"`
	RecentTodos           []TodoItem   `json:"recent_todos"`
}
