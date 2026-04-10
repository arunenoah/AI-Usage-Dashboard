package copilot

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/adapters"
	"github.com/ai-sessions/ai-sessions/internal/models"
)

// Adapter implements adapters.Adapter for GitHub Copilot Chat JSONL session files.
// VS Code stores chat sessions at:
//
//	Windows: %APPDATA%\Code\User\workspaceStorage\<hash>\chatSessions\<uuid>.jsonl
//	Linux:   ~/.config/Code/User/workspaceStorage/<hash>/chatSessions/<uuid>.jsonl
//	macOS:   ~/Library/Application Support/Code/User/workspaceStorage/<hash>/chatSessions/<uuid>.jsonl
type Adapter struct{}

var _ adapters.Adapter = (*Adapter)(nil)

func (a *Adapter) Name() string { return "github-copilot" }

// vsCodeUserDir returns the VS Code User config directory for the current OS.
// homedir is the value of os.UserHomeDir().
func vsCodeUserDir(homedir string) []string {
	switch runtime.GOOS {
	case "windows":
		// %APPDATA% is usually C:\Users\<user>\AppData\Roaming
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			appdata = filepath.Join(homedir, "AppData", "Roaming")
		}
		return []string{
			filepath.Join(appdata, "Code", "User"),
			filepath.Join(appdata, "Code - Insiders", "User"),
		}
	case "darwin":
		return []string{
			filepath.Join(homedir, "Library", "Application Support", "Code", "User"),
			filepath.Join(homedir, "Library", "Application Support", "Code - Insiders", "User"),
		}
	default: // linux and others
		configDir := os.Getenv("XDG_CONFIG_HOME")
		if configDir == "" {
			configDir = filepath.Join(homedir, ".config")
		}
		return []string{
			filepath.Join(configDir, "Code", "User"),
			filepath.Join(configDir, "Code - Insiders", "User"),
		}
	}
}

// Detect finds all Copilot Chat JSONL session files across all VS Code workspaces.
func (a *Adapter) Detect(homedir string) []string {
	var paths []string
	for _, userDir := range vsCodeUserDir(homedir) {
		wsRoot := filepath.Join(userDir, "workspaceStorage")
		_ = filepath.Walk(wsRoot, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			// Only recurse one level into workspaceStorage/<hash>/
			rel, _ := filepath.Rel(wsRoot, path)
			depth := len(strings.Split(rel, string(filepath.Separator)))
			// depth=1 → workspace hash dir, depth=2 → child dirs inside hash
			if info.IsDir() && depth > 3 {
				return filepath.SkipDir
			}
			if !info.IsDir() {
				return nil
			}
			// Only process hash-level dirs that have GitHub.copilot-chat inside
			if depth != 1 {
				return nil
			}
			copilotDir := filepath.Join(path, "GitHub.copilot-chat")
			if _, err := os.Stat(copilotDir); os.IsNotExist(err) {
				return nil
			}
			chatDir := filepath.Join(path, "chatSessions")
			_ = filepath.Walk(chatDir, func(p string, fi os.FileInfo, e error) error {
				if e != nil || fi.IsDir() {
					return nil
				}
				if strings.HasSuffix(p, ".jsonl") {
					paths = append(paths, p)
				}
				return nil
			})
			return nil
		})
	}
	return paths
}

// ── JSONL entry types ────────────────────────────────────────────────────────

// cpEntry is the raw shape of one line in a Copilot Chat JSONL file.
type cpEntry struct {
	Kind int             `json:"kind"`
	K    []any           `json:"k,omitempty"` // key path for patches (kind=1,2)
	V    json.RawMessage `json:"v"`
}

// cpSession is the session object inside kind=0.
type cpSession struct {
	SessionID    string       `json:"sessionId"`
	CreationDate int64        `json:"creationDate"` // Unix ms
	CustomTitle  string       `json:"customTitle"`
	Requests     []cpRequest  `json:"requests"`
}

// cpRequest is one user→assistant conversation turn.
type cpRequest struct {
	RequestID  string      `json:"requestId"`
	Timestamp  int64       `json:"timestamp"` // Unix ms
	ModelID    string      `json:"modelId"`   // e.g. "copilot/claude-sonnet-4.6"
	Message    cpMessage   `json:"message"`
	Response   []cpRespPart `json:"response"`
	ModeInfo   cpModeInfo  `json:"modeInfo"`
}

type cpMessage struct {
	Text string `json:"text"`
}

type cpModeInfo struct {
	Kind string `json:"kind"` // "agent", "ask", "edit"
}

// cpRespPart is one element in a request's response array.
type cpRespPart struct {
	Kind  string `json:"kind,omitempty"` // "thinking", "toolInvocationSerialized", "progressTaskSerialized", etc.
	Value string `json:"value,omitempty"`
	ToolID string `json:"toolId,omitempty"` // when kind=="toolInvocationSerialized"
	InvocationMessage *cpInvMsg `json:"invocationMessage,omitempty"`
}

type cpInvMsg struct {
	Value string `json:"value"`
}

// Parse reads a Copilot Chat JSONL session file and returns a Session.
func (a *Adapter) Parse(path string) (*models.Session, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	base := filepath.Base(path)
	sessionID := strings.TrimSuffix(base, ".jsonl")

	// Derive project dir from workspace.json two levels up:
	// path = .../workspaceStorage/<hash>/chatSessions/<uuid>.jsonl
	hashDir := filepath.Dir(filepath.Dir(path))
	projectDir := readWorkspaceDir(hashDir)

	sess := &models.Session{
		ID:          sessionID,
		FilePath:    path,
		ProjectDir:  projectDir,
		Source:      "github-copilot",
		ToolCounts:  make(map[string]int),
		ToolSamples: make(map[string][]string),
	}

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 10*1024*1024), 10*1024*1024)

	// requestsByIndex holds the accumulated requests in order.
	// VS Code builds the requests array via incremental patches.
	var baseRequests []cpRequest            // from kind=0
	appendedRequests := make(map[int]cpRequest) // index → request from k=["requests"] patches
	responsePatches := make(map[int][]cpRespPart) // req index → final response (from k=["requests",N,"response"])
	var customTitle string
	var requestsAppendIdx int // tracks the number of append patches seen so far

	for scanner.Scan() {
		var entry cpEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}

		switch entry.Kind {
		case 0:
			// Full session snapshot
			var snap cpSession
			if json.Unmarshal(entry.V, &snap) == nil {
				if snap.SessionID != "" {
					sess.ID = snap.SessionID
				}
				if snap.CreationDate > 0 {
					sess.StartTime = msToTime(snap.CreationDate)
				}
				if snap.CustomTitle != "" {
					customTitle = snap.CustomTitle
				}
				baseRequests = snap.Requests
			}

		case 1:
			// Scalar patch — we only care about customTitle
			if len(entry.K) == 1 {
				if k, ok := entry.K[0].(string); ok && k == "customTitle" {
					var s string
					if json.Unmarshal(entry.V, &s) == nil {
						customTitle = s
					}
				}
			}

		case 2:
			// Deep patch
			if len(entry.K) == 0 {
				continue
			}
			k0, _ := entry.K[0].(string)

			if k0 == "requests" && len(entry.K) == 1 {
				// Appends one or more requests to the requests array
				var reqs []cpRequest
				if json.Unmarshal(entry.V, &reqs) == nil {
					for _, req := range reqs {
						appendedRequests[requestsAppendIdx] = req
						requestsAppendIdx++
					}
				}
			} else if k0 == "requests" && len(entry.K) == 3 {
				// k = ["requests", N, "response"] — updates the response for request N
				idxFloat, ok := entry.K[1].(float64)
				field, _ := entry.K[2].(string)
				if ok && field == "response" {
					idx := int(idxFloat)
					var parts []cpRespPart
					if json.Unmarshal(entry.V, &parts) == nil {
						responsePatches[idx] = parts // keep last (most complete) patch
					}
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// Merge all requests:
	// 1. Start with base requests from kind=0 snapshot
	// 2. Supplement/override with appended requests from kind=2 patches
	allRequests := mergeRequests(baseRequests, appendedRequests, responsePatches)

	// Build session stats from merged requests
	firstUser := true
	for _, req := range allRequests {
		if req.Message.Text == "" {
			continue
		}
		sess.UserTurns++
		sess.AssistTurns++

		// Timestamps
		if req.Timestamp > 0 {
			t := msToTime(req.Timestamp)
			if sess.StartTime.IsZero() || t.Before(sess.StartTime) {
				sess.StartTime = t
			}
			if t.After(sess.EndTime) {
				sess.EndTime = t
			}
		}

		if firstUser {
			sess.FirstPrompt = truncate(req.Message.Text, 120)
			firstUser = false
		}

		// Model
		if sess.Model == "" && req.ModelID != "" {
			sess.Model = shortModel(req.ModelID)
		}

		// Tool counts from response
		for _, part := range req.Response {
			if part.Kind == "toolInvocationSerialized" && part.ToolID != "" {
				toolName := copilotToolName(part.ToolID)
				sess.ToolCounts[toolName]++
				if len(sess.ToolSamples[toolName]) < 5 && part.InvocationMessage != nil {
					sess.ToolSamples[toolName] = append(sess.ToolSamples[toolName], truncate(part.InvocationMessage.Value, 80))
				}
			}
		}
	}

	if customTitle != "" {
		sess.FirstPrompt = customTitle
	}

	if sess.StartTime.IsZero() {
		sess.StartTime = time.Now()
	}
	if sess.EndTime.IsZero() {
		sess.EndTime = sess.StartTime
	}

	return sess, nil
}

// ParseTurns returns conversation turns suitable for the session detail view (text truncated to 500 chars).
func (a *Adapter) ParseTurns(path string) ([]models.TurnEntry, error) {
	return a.parseTurns(path, 500)
}

// ParseTurnsFull returns conversation turns with no text truncation.
func (a *Adapter) ParseTurnsFull(path string) ([]models.TurnEntry, error) {
	return a.parseTurns(path, 0)
}

func (a *Adapter) parseTurns(path string, maxTextLen int) ([]models.TurnEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 10*1024*1024), 10*1024*1024)

	var baseRequests []cpRequest
	appendedRequests := make(map[int]cpRequest)
	responsePatches := make(map[int][]cpRespPart)
	var requestsAppendIdx int

	for scanner.Scan() {
		var entry cpEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}
		switch entry.Kind {
		case 0:
			var snap cpSession
			if json.Unmarshal(entry.V, &snap) == nil {
				baseRequests = snap.Requests
			}
		case 2:
			if len(entry.K) == 0 {
				continue
			}
			k0, _ := entry.K[0].(string)
			if k0 == "requests" && len(entry.K) == 1 {
				var reqs []cpRequest
				if json.Unmarshal(entry.V, &reqs) == nil {
					for _, req := range reqs {
						appendedRequests[requestsAppendIdx] = req
						requestsAppendIdx++
					}
				}
			} else if k0 == "requests" && len(entry.K) == 3 {
				idxFloat, ok := entry.K[1].(float64)
				field, _ := entry.K[2].(string)
				if ok && field == "response" {
					idx := int(idxFloat)
					var parts []cpRespPart
					if json.Unmarshal(entry.V, &parts) == nil {
						responsePatches[idx] = parts
					}
				}
			}
		}
	}

	allRequests := mergeRequests(baseRequests, appendedRequests, responsePatches)

	var turns []models.TurnEntry
	for _, req := range allRequests {
		if req.Message.Text == "" {
			continue
		}
		userText := req.Message.Text
		if maxTextLen > 0 && len([]rune(userText)) > maxTextLen {
			userText = string([]rune(userText)[:maxTextLen]) + "…"
		}

		ts := msToTime(req.Timestamp)
		turns = append(turns, models.TurnEntry{
			Role:      "user",
			Text:      userText,
			Timestamp: ts,
		})

		var assistText string
		var toolCalls []string
		toolInputs := make(map[string]string)
		for _, part := range req.Response {
			switch part.Kind {
			case "toolInvocationSerialized":
				toolName := copilotToolName(part.ToolID)
				toolCalls = append(toolCalls, toolName)
				if part.InvocationMessage != nil {
					toolInputs[toolName] = truncate(part.InvocationMessage.Value, 120)
				}
			case "thinking", "progressTaskSerialized", "mcpServersStarting", "undoStop", "codeblockUri", "textEditGroup":
				// skip non-text parts
			default:
				if part.Value != "" && assistText == "" {
					assistText = part.Value
					if maxTextLen > 0 && len([]rune(assistText)) > maxTextLen {
						assistText = string([]rune(assistText)[:maxTextLen]) + "…"
					}
				}
			}
		}

		// Remove duplicate tool call names
		toolCalls = dedupe(toolCalls)

		turns = append(turns, models.TurnEntry{
			Role:       "assistant",
			Text:       assistText,
			ToolCalls:  toolCalls,
			ToolInputs: toolInputs,
			Model:      shortModel(req.ModelID),
			Timestamp:  ts,
		})
	}

	return turns, scanner.Err()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// mergeRequests combines the base requests (from kind=0) with append patches (kind=2 k=["requests"]),
// applying the latest response patches for each request index.
func mergeRequests(base []cpRequest, appended map[int]cpRequest, responsePatches map[int][]cpRespPart) []cpRequest {
	// Build a sorted list of all indices
	indexSet := make(map[int]struct{})
	for i := range base {
		indexSet[i] = struct{}{}
	}
	for i := range appended {
		indexSet[i] = struct{}{}
	}

	indices := make([]int, 0, len(indexSet))
	for i := range indexSet {
		indices = append(indices, i)
	}
	sort.Ints(indices)

	var result []cpRequest
	for _, i := range indices {
		var req cpRequest
		if i < len(base) {
			req = base[i]
		}
		if r, ok := appended[i]; ok {
			// Appended patch overrides base for this index
			req = r
		}
		// Apply the latest response patch if available
		if parts, ok := responsePatches[i]; ok {
			req.Response = parts
		}
		result = append(result, req)
	}
	return result
}

// readWorkspaceDir reads the workspace.json in hashDir and returns the decoded project path.
func readWorkspaceDir(hashDir string) string {
	data, err := os.ReadFile(filepath.Join(hashDir, "workspace.json"))
	if err != nil {
		return ""
	}
	var ws struct {
		Folder string `json:"folder"`
	}
	if json.Unmarshal(data, &ws) != nil || ws.Folder == "" {
		return ""
	}
	// folder is a file URI like "file:///c%3A/path/to/project"
	u, err := url.Parse(ws.Folder)
	if err != nil {
		return ws.Folder
	}
	p := u.Path
	// On Windows, clean leading slash from /c:/path → c:/path
	if len(p) > 2 && p[0] == '/' && p[2] == ':' {
		p = p[1:]
	}
	return p
}

// msToTime converts a Unix millisecond timestamp to time.Time.
func msToTime(ms int64) time.Time {
	if ms <= 0 {
		return time.Time{}
	}
	return time.Unix(ms/1000, (ms%1000)*int64(time.Millisecond))
}

// shortModel strips the "copilot/" vendor prefix from model IDs.
// "copilot/claude-sonnet-4.6" → "claude-sonnet-4.6"
func shortModel(modelID string) string {
	if idx := strings.Index(modelID, "/"); idx >= 0 {
		return modelID[idx+1:]
	}
	return modelID
}

// copilotToolName converts a Copilot tool ID to a short display name.
// e.g. "copilot_replaceString" → "replaceString"
func copilotToolName(toolID string) string {
	if idx := strings.Index(toolID, "_"); idx >= 0 {
		return toolID[idx+1:]
	}
	return toolID
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "…"
}

func dedupe(ss []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, s := range ss {
		if _, ok := seen[s]; !ok {
			seen[s] = struct{}{}
			out = append(out, s)
		}
	}
	return out
}
