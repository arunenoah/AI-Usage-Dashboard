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

	base := filepath.Base(path)
	sessionID := strings.TrimSuffix(base, ".jsonl")
	projectDir := decodeProjectDir(filepath.Dir(path))

	session := &models.Session{
		ID:          sessionID,
		FilePath:    path,
		ProjectDir:  projectDir,
		Source:      "claude-code",
		ToolCounts:  make(map[string]int),
		ToolSamples: make(map[string][]string),
	}

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 10*1024*1024), 10*1024*1024)
	firstUser := true
	var turnDurations []int64

	for scanner.Scan() {
		var entry models.RawEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}

		if !entry.Timestamp.IsZero() {
			if session.StartTime.IsZero() || entry.Timestamp.Before(session.StartTime) {
				session.StartTime = entry.Timestamp
			}
			if entry.Timestamp.After(session.EndTime) {
				session.EndTime = entry.Timestamp
			}
		}

		switch entry.Type {
		case "user":
			session.UserTurns++
			// Capture git branch from first user entry
			if session.GitBranch == "" && entry.GitBranch != "" {
				session.GitBranch = entry.GitBranch
			}
			if firstUser && entry.Message != nil {
				for _, c := range entry.Message.Content {
					if c.Type == "text" && c.Text != "" {
						session.FirstPrompt = truncate(c.Text, 120)
						firstUser = false
						break
					}
				}
			}

		case "assistant":
			session.AssistTurns++
			if entry.Message != nil {
				// Capture model
				if session.Model == "" && entry.Message.Model != "" {
					session.Model = entry.Message.Model
				}
				if u := entry.Message.Usage; u != nil {
					session.TotalUsage.InputTokens += u.InputTokens
					session.TotalUsage.OutputTokens += u.OutputTokens
					session.TotalUsage.CacheReadInputTokens += u.CacheReadInputTokens
					session.TotalUsage.CacheCreationInputTokens += u.CacheCreationInputTokens
				}
				for _, c := range entry.Message.Content {
					if c.Type == "tool_use" && c.Name != "" {
						session.ToolCounts[c.Name]++
						// Capture sample inputs (up to 5 per tool)
						if len(session.ToolSamples[c.Name]) < 5 {
							sample := extractToolSample(c.Name, c.Input)
							if sample != "" {
								session.ToolSamples[c.Name] = append(session.ToolSamples[c.Name], sample)
							}
						}
					}
				}
			}

		case "system":
			if entry.Subtype == "turn_duration" && entry.DurationMs > 0 {
				turnDurations = append(turnDurations, entry.DurationMs)
			}
		}
	}

	// Compute turn duration stats
	if len(turnDurations) > 0 {
		var sum, max int64
		for _, d := range turnDurations {
			sum += d
			if d > max {
				max = d
			}
		}
		session.MaxTurnDurationMs = max
		session.AvgTurnDurationMs = sum / int64(len(turnDurations))
	}

	return session, scanner.Err()
}

// ParseTurns returns the full turn-by-turn detail for a session.
// maxTextLen controls truncation (0 = unlimited).
func (a *Adapter) ParseTurns(path string) ([]models.TurnEntry, error) {
	return a.parseTurns(path, 500)
}

// ParseTurnsFull returns turns with no text truncation (for conversation detail view).
func (a *Adapter) ParseTurnsFull(path string) ([]models.TurnEntry, error) {
	return a.parseTurns(path, 0)
}

func (a *Adapter) parseTurns(path string, maxTextLen int) ([]models.TurnEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	var turns []models.TurnEntry
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 10*1024*1024), 10*1024*1024)

	// We need to pair system.turn_duration with the preceding assistant turn
	lastAssistantIdx := -1
	seenUUIDs := make(map[string]bool) // deduplicate duplicate JSONL entries

	for scanner.Scan() {
		var entry models.RawEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}
		// Skip duplicates (assistant turns appear twice in JSONL)
		if entry.UUID != "" {
			key := entry.Type + ":" + entry.UUID
			if seenUUIDs[key] {
				continue
			}
			seenUUIDs[key] = true
		}

		switch entry.Type {
		case "user":
			if entry.Message == nil {
				continue
			}
			var text string
			for _, c := range entry.Message.Content {
				if c.Type == "text" && c.Text != "" {
					text = truncateMaybe(c.Text, maxTextLen)
					break
				}
			}
			if text == "" {
				continue // skip tool_result-only user turns
			}
			turns = append(turns, models.TurnEntry{
				Role:      "user",
				Text:      text,
				Timestamp: entry.Timestamp,
			})
			lastAssistantIdx = -1

		case "assistant":
			if entry.Message == nil {
				continue
			}
			var text string
			var toolCalls []string
			toolInputs := make(map[string]string)
			for _, c := range entry.Message.Content {
				if c.Type == "text" && c.Text != "" && text == "" {
					text = truncateMaybe(c.Text, maxTextLen)
				}
				if c.Type == "thinking" && c.Thinking != "" && text == "" {
					text = "[thinking] " + truncateMaybe(c.Thinking, 200)
				}
				if c.Type == "tool_use" && c.Name != "" {
					toolCalls = append(toolCalls, c.Name)
					// Extract key input param per tool type
					if inp, ok := c.Input.(map[string]any); ok {
						switch c.Name {
						case "Write", "Read", "Edit", "NotebookEdit":
							if v, ok := inp["file_path"].(string); ok {
								toolInputs[c.Name+":"+v] = v
							}
						case "Bash":
							if v, ok := inp["command"].(string); ok {
								toolInputs[c.Name] = truncate(v, 80)
							}
						case "Agent":
							if v, ok := inp["description"].(string); ok {
								toolInputs["Agent:"+v] = v
							} else if v, ok := inp["prompt"].(string); ok {
								toolInputs["Agent"] = truncate(v, 80)
							}
						case "Grep", "Glob":
							if v, ok := inp["pattern"].(string); ok {
								toolInputs[c.Name] = v
							}
						}
					}
				}
			}
			turn := models.TurnEntry{
				Role:       "assistant",
				Text:       text,
				ToolCalls:  toolCalls,
				ToolInputs: toolInputs,
				Model:      entry.Message.Model,
				Timestamp:  entry.Timestamp,
			}
			if entry.Message.Usage != nil {
				turn.Usage = entry.Message.Usage
			}
			turns = append(turns, turn)
			lastAssistantIdx = len(turns) - 1

		case "system":
			if entry.Subtype == "turn_duration" && entry.DurationMs > 0 && lastAssistantIdx >= 0 {
				turns[lastAssistantIdx].DurationMs = entry.DurationMs
			}
		}
	}

	return turns, scanner.Err()
}

func extractToolSample(name string, input any) string {
	inp, ok := input.(map[string]any)
	if !ok {
		return ""
	}
	switch name {
	case "Write", "Read", "Edit", "NotebookEdit":
		if v, ok := inp["file_path"].(string); ok {
			return v
		}
	case "Bash":
		if v, ok := inp["command"].(string); ok {
			return truncate(v, 80)
		}
	case "Agent":
		if v, ok := inp["description"].(string); ok {
			return v
		}
		if v, ok := inp["prompt"].(string); ok {
			return truncate(v, 80)
		}
	case "Grep":
		pattern, _ := inp["pattern"].(string)
		path, _ := inp["path"].(string)
		if path != "" {
			return pattern + " in " + path
		}
		return pattern
	case "Glob":
		if v, ok := inp["pattern"].(string); ok {
			return v
		}
	case "WebFetch", "WebSearch":
		if v, ok := inp["url"].(string); ok {
			return v
		}
		if v, ok := inp["query"].(string); ok {
			return v
		}
	}
	return ""
}

func decodeProjectDir(encoded string) string {
	base := filepath.Base(encoded)
	if strings.HasPrefix(base, "-") {
		base = base[1:]
	}
	return "/" + strings.ReplaceAll(base, "-", "/")
}

// truncateMaybe truncates only when n > 0; n == 0 means unlimited.
func truncateMaybe(s string, n int) string {
	if n <= 0 {
		return s
	}
	return truncate(s, n)
}

func truncate(s string, n int) string {
	// Handle multi-byte safely
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "…"
}
