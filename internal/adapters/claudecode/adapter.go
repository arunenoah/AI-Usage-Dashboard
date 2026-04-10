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

	for scanner.Scan() {
		var entry models.RawEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}

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

func decodeProjectDir(encoded string) string {
	base := filepath.Base(encoded)
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
