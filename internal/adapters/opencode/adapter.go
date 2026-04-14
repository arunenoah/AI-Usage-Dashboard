package opencode

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/adapters"
	"github.com/ai-sessions/ai-sessions/internal/models"

	_ "github.com/mattn/go-sqlite3"
)

// Adapter implements adapters.Adapter for OpenCode's SQLite database.
// OpenCode stores sessions at ~/.local/share/opencode/opencode.db
type Adapter struct{}

var _ adapters.Adapter = (*Adapter)(nil)

func (a *Adapter) Name() string { return "opencode" }

// Detect returns the path to the opencode database if it exists.
func (a *Adapter) Detect(homedir string) []string {
	dbPath := filepath.Join(homedir, ".local", "share", "opencode", "opencode.db")
	if _, err := os.Stat(dbPath); err == nil {
		return []string{dbPath}
	}
	return nil
}

// sessionRow holds a row from the session table.
type sessionRow struct {
	ID                string
	Title             string
	Directory         string
	TimeCreated       int64
	TimeUpdated       int64
	SummaryAdditions  sql.NullInt64
	SummaryDeletions  sql.NullInt64
	SummaryFiles      sql.NullInt64
}

// partData is the JSON structure inside part.data for step-finish parts.
type partData struct {
	Type   string    `json:"type"`
	Tool   string    `json:"tool,omitempty"`
	CallID string    `json:"callID,omitempty"`
	State  *struct {
		Status string `json:"status,omitempty"`
		Input  map[string]interface{} `json:"input,omitempty"`
	} `json:"state,omitempty"`
	Tokens *struct {
		Total     int `json:"total"`
		Input     int `json:"input"`
		Output    int `json:"output"`
		Reasoning int `json:"reasoning"`
		Cache     *struct {
			Read  int `json:"read"`
			Write int `json:"write"`
		} `json:"cache,omitempty"`
	} `json:"tokens,omitempty"`
	Cost float64 `json:"cost"`
}

// messageData is the JSON structure inside message.data.
type messageData struct {
	Role      string `json:"role"`
	ModelID   string `json:"modelID,omitempty"`
	Mode      string `json:"mode,omitempty"`
	Agent     string `json:"agent,omitempty"`
}

// Parse reads the opencode SQLite database and returns sessions one at a time.
// Since Detect returns only one path (the DB), we parse ALL sessions from it.
// The store calls Parse once per path, so we return a synthetic combined session
// on first call, then individual sessions via ParseAll.
func (a *Adapter) Parse(dbPath string) (*models.Session, error) {
	// Parse returns just the first session; use ParseAll for the full list.
	sessions, err := a.ParseAll(dbPath)
	if err != nil || len(sessions) == 0 {
		return nil, err
	}
	return sessions[0], nil
}

// ParseAll reads all sessions from the opencode database.
func (a *Adapter) ParseAll(dbPath string) ([]*models.Session, error) {
	db, err := sql.Open("sqlite3", dbPath+"?mode=ro")
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(`
		SELECT id, title, directory, time_created, time_updated,
		       summary_additions, summary_deletions, summary_files
		FROM session ORDER BY time_created DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*models.Session
	for rows.Next() {
		var sr sessionRow
		if err := rows.Scan(&sr.ID, &sr.Title, &sr.Directory, &sr.TimeCreated, &sr.TimeUpdated,
			&sr.SummaryAdditions, &sr.SummaryDeletions, &sr.SummaryFiles); err != nil {
			continue
		}

		sess := &models.Session{
			ID:          sr.ID,
			FilePath:    dbPath,
			ProjectDir:  sr.Directory,
			Source:      "opencode",
			StartTime:   time.UnixMilli(sr.TimeCreated),
			EndTime:     time.UnixMilli(sr.TimeUpdated),
			FirstPrompt: sr.Title,
			ToolCounts:  make(map[string]int),
		}

		// Count messages and extract model
		msgRows, err := db.Query(`
			SELECT data FROM message WHERE session_id = ? ORDER BY time_created
		`, sr.ID)
		if err == nil {
			for msgRows.Next() {
				var dataStr string
				if err := msgRows.Scan(&dataStr); err != nil {
					continue
				}
				var md messageData
				if json.Unmarshal([]byte(dataStr), &md) != nil {
					continue
				}
				if md.Role == "user" {
					sess.UserTurns++
				} else if md.Role == "assistant" {
					sess.AssistTurns++
					if md.ModelID != "" && sess.Model == "" {
						sess.Model = md.ModelID
					}
				}
			}
			msgRows.Close()
		}

		// Aggregate tokens and tool usage from parts
		partRows, err := db.Query(`
			SELECT data FROM part WHERE session_id = ?
		`, sr.ID)
		if err == nil {
			for partRows.Next() {
				var dataStr string
				if err := partRows.Scan(&dataStr); err != nil {
					continue
				}
				var pd partData
				if json.Unmarshal([]byte(dataStr), &pd) != nil {
					continue
				}

				// Tool usage
				if pd.Type == "tool" && pd.State != nil {
					toolName := pd.Tool
					if toolName == "" {
						toolName = "unknown"
					}
					// Normalize tool names to match Claude Code conventions
					switch strings.ToLower(toolName) {
					case "read", "file_read":
						toolName = "Read"
					case "write", "file_write":
						toolName = "Write"
					case "edit", "file_edit":
						toolName = "Edit"
					case "bash", "shell", "terminal":
						toolName = "Bash"
					case "glob", "list_files":
						toolName = "Glob"
					case "grep", "search":
						toolName = "Grep"
					}
					sess.ToolCounts[toolName]++
				}

				// Token aggregation from step-finish parts
				if pd.Type == "step-finish" && pd.Tokens != nil {
					sess.TotalUsage.InputTokens += pd.Tokens.Input
					sess.TotalUsage.OutputTokens += pd.Tokens.Output
					if pd.Tokens.Cache != nil {
						sess.TotalUsage.CacheReadInputTokens += pd.Tokens.Cache.Read
						sess.TotalUsage.CacheCreationInputTokens += pd.Tokens.Cache.Write
					}
				}
			}
			partRows.Close()
		}

		// Get first user prompt text
		var firstPrompt sql.NullString
		db.QueryRow(`
			SELECT json_extract(p.data, '$.text')
			FROM part p
			JOIN message m ON p.message_id = m.id
			WHERE p.session_id = ? AND json_extract(p.data, '$.type') = 'text'
			  AND json_extract(m.data, '$.role') = 'user'
			ORDER BY p.time_created LIMIT 1
		`, sr.ID).Scan(&firstPrompt)
		if firstPrompt.Valid && firstPrompt.String != "" {
			sess.FirstPrompt = firstPrompt.String
		}

		sessions = append(sessions, sess)
	}

	return sessions, nil
}

// ParseTurnsFull returns turn details for a specific session.
func (a *Adapter) ParseTurnsFull(dbPath string, sessionID string) ([]models.TurnEntry, error) {
	db, err := sql.Open("sqlite3", dbPath+"?mode=ro")
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(`
		SELECT m.data, m.time_created
		FROM message m
		WHERE m.session_id = ?
		ORDER BY m.time_created
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var turns []models.TurnEntry
	for rows.Next() {
		var dataStr string
		var ts int64
		if err := rows.Scan(&dataStr, &ts); err != nil {
			continue
		}
		var md messageData
		if json.Unmarshal([]byte(dataStr), &md) != nil {
			continue
		}

		turn := models.TurnEntry{
			Role:      md.Role,
			Timestamp: time.UnixMilli(ts),
			Model:     md.ModelID,
		}

		// Get text parts for this message
		partRows, err := db.Query(`
			SELECT data FROM part WHERE message_id = (
				SELECT id FROM message WHERE session_id = ? AND time_created = ?
			) AND json_extract(data, '$.type') = 'text' LIMIT 1
		`, sessionID, ts)
		if err == nil {
			for partRows.Next() {
				var pData string
				if partRows.Scan(&pData) == nil {
					var pd struct{ Text string `json:"text"` }
					if json.Unmarshal([]byte(pData), &pd) == nil {
						turn.Text = pd.Text
						if len(turn.Text) > 500 {
							turn.Text = turn.Text[:500]
						}
					}
				}
			}
			partRows.Close()
		}

		turns = append(turns, turn)
	}

	sort.Slice(turns, func(i, j int) bool {
		return turns[i].Timestamp.Before(turns[j].Timestamp)
	})

	return turns, nil
}
