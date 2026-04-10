package models

import "time"

// RawEntry is one line from a Claude Code JSONL session file
type RawEntry struct {
	Type      string      `json:"type"`
	UUID      string      `json:"uuid"`
	Timestamp time.Time   `json:"timestamp"`
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
	ID          string         `json:"id"`
	FilePath    string         `json:"file_path"`
	ProjectDir  string         `json:"project_dir"`
	StartTime   time.Time      `json:"start_time"`
	EndTime     time.Time      `json:"end_time"`
	UserTurns   int            `json:"user_turns"`
	AssistTurns int            `json:"assist_turns"`
	TotalUsage  Usage          `json:"total_usage"`
	ToolCounts  map[string]int `json:"tool_counts"`
	FirstPrompt string         `json:"first_prompt"`
	Source      string         `json:"source"` // "claude-code"
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
	TotalSessions     int            `json:"total_sessions"`
	TotalInputTokens  int            `json:"total_input_tokens"`
	TotalOutputTokens int            `json:"total_output_tokens"`
	TotalCostUSD      float64        `json:"total_cost_usd"`
	AvgSessionTokens  int            `json:"avg_session_tokens"`
	Daily             []DailyStats   `json:"daily"`
	ToolCounts        map[string]int `json:"tool_counts"`
	ActiveSession     *Session       `json:"active_session,omitempty"`
}
