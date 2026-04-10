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
		ID:         sessionID,
		FilePath:   path,
		ProjectDir: projectDir,
		Source:     "claude-code",
		ToolCounts: make(map[string]int),
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

// ParseTurns returns the full turn-by-turn detail for a session
func (a *Adapter) ParseTurns(path string) ([]models.TurnEntry, error) {
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

	for scanner.Scan() {
		var entry models.RawEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}

		switch entry.Type {
		case "user":
			if entry.Message == nil {
				continue
			}
			var text string
			for _, c := range entry.Message.Content {
				if c.Type == "text" && c.Text != "" {
					text = truncate(c.Text, 500)
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
			for _, c := range entry.Message.Content {
				if c.Type == "text" && c.Text != "" && text == "" {
					text = truncate(c.Text, 500)
				}
				if c.Type == "thinking" && c.Thinking != "" && text == "" {
					text = "[thinking] " + truncate(c.Thinking, 200)
				}
				if c.Type == "tool_use" && c.Name != "" {
					toolCalls = append(toolCalls, c.Name)
				}
			}
			turn := models.TurnEntry{
				Role:      "assistant",
				Text:      text,
				ToolCalls: toolCalls,
				Model:     entry.Message.Model,
				Timestamp: entry.Timestamp,
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

func decodeProjectDir(encoded string) string {
	base := filepath.Base(encoded)
	if strings.HasPrefix(base, "-") {
		base = base[1:]
	}
	return "/" + strings.ReplaceAll(base, "-", "/")
}

func truncate(s string, n int) string {
	// Handle multi-byte safely
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "…"
}
