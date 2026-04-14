# Adapter Development Guide

How to add support for a new AI tool (Cursor, Windsurf, Copilot, OpenCode).

## What is an Adapter?

An adapter is a module that:
1. Discovers session files for a specific AI tool
2. Parses tool-specific JSONL/JSON format
3. Extracts turns, tokens, tool calls, metadata
4. Returns standardized `Session` structs

**Why adapters?**
- Different tools store sessions differently
- Claude Code → `~/.claude/projects/*/session-*.jsonl`
- Copilot → `~/.copilot/history.json` or similar
- Windsurf → Different path and format
- One adapter per tool, shared `Store` interface

## Adapter Interface

```go
type Adapter interface {
    // Load all sessions from directory
    Load(dirPath string) ([]Session, error)
    
    // Watch directory and invoke callback on changes
    Watch(dirPath string, callback func(Session)) error
}
```

**Two methods to implement:**

### 1. Load()

Scans a directory, finds and parses all session files, returns a slice of sessions.

**Responsibility:**
- Recursively scan directory
- Find session files (e.g., `*.jsonl`, `*.json`)
- Parse each file
- Extract turns, tokens, tools, metadata
- Return `[]Session`

**Example: Claude Code**
```go
func (a *Adapter) Load(dirPath string) ([]Session, error) {
    var sessions []Session
    
    // Walk ~/.claude/projects/ recursively
    filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
        if strings.HasSuffix(path, ".jsonl") {
            // Parse JSONL file
            session := parseSessionFile(path)
            sessions = append(sessions, session)
        }
        return nil
    })
    
    return sessions, nil
}
```

### 2. Watch()

Monitors for new/updated session files and invokes callback.

**Responsibility:**
- Create filesystem watcher
- Register directory for monitoring
- Detect new/changed session files
- Reparse changed file
- Call `callback(session)`

**Example: Claude Code**
```go
func (a *Adapter) Watch(dirPath string, callback func(Session)) error {
    watcher, err := fsnotify.NewWatcher()
    if err != nil {
        return err
    }
    
    // Recursively add directories
    addWatchDirs(watcher, dirPath)
    
    go func() {
        for {
            select {
            case event := <-watcher.Events:
                if isSessionFile(event.Name) {
                    session := parseSessionFile(event.Name)
                    callback(session)
                }
            case err := <-watcher.Errors:
                log.Println("watch error:", err)
            }
        }
    }()
    
    return nil
}
```

## Step-by-Step Example: Cursor Adapter

### Step 1: Create Package Structure

```bash
mkdir -p internal/adapters/cursor
touch internal/adapters/cursor/adapter.go
```

### Step 2: Define the Adapter

```go
// internal/adapters/cursor/adapter.go

package cursor

import (
    "encoding/json"
    "os"
    "path/filepath"
    "log"
    
    "ai-sessions/internal/models"
    "github.com/fsnotify/fsnotify"
)

type Adapter struct{}

func NewAdapter() *Adapter {
    return &Adapter{}
}
```

### Step 3: Implement Load()

First, understand Cursor's session format. Assume it stores sessions in:
```
~/.cursor/sessions/
  session-1.json
  session-2.json
```

Each file:
```json
{
  "id": "session-1",
  "project": "/Users/name/projects/app",
  "turns": [
    {
      "role": "user",
      "content": "Fix the login bug",
      "tokens": 150,
      "timestamp": "2026-04-14T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "I'll help...",
      "tokens": 300,
      "timestamp": "2026-04-14T10:00:15Z"
    }
  ]
}
```

Implement Load():
```go
func (a *Adapter) Load(dirPath string) ([]models.Session, error) {
    var sessions []models.Session
    
    // Cursor sessions are in ~/.cursor/sessions/
    cursorPath := filepath.Join(os.ExpandUser("~"), ".cursor", "sessions")
    
    // Check if directory exists
    if _, err := os.Stat(cursorPath); os.IsNotExist(err) {
        return sessions, nil  // No Cursor sessions found
    }
    
    // Read directory
    files, err := os.ReadDir(cursorPath)
    if err != nil {
        return nil, err
    }
    
    // Parse each session-*.json file
    for _, file := range files {
        if filepath.Ext(file.Name()) != ".json" {
            continue
        }
        
        filePath := filepath.Join(cursorPath, file.Name())
        session, err := parseSessionFile(filePath)
        if err != nil {
            log.Printf("error parsing %s: %v\n", filePath, err)
            continue  // Skip bad files
        }
        
        sessions = append(sessions, session)
    }
    
    return sessions, nil
}

func parseSessionFile(filePath string) (models.Session, error) {
    data, err := os.ReadFile(filePath)
    if err != nil {
        return models.Session{}, err
    }
    
    var raw struct {
        ID       string `json:"id"`
        Project  string `json:"project"`
        Turns    []struct {
            Role      string `json:"role"`
            Content   string `json:"content"`
            Tokens    int    `json:"tokens"`
            Timestamp string `json:"timestamp"`
        } `json:"turns"`
    }
    
    err = json.Unmarshal(data, &raw)
    if err != nil {
        return models.Session{}, err
    }
    
    // Build Session struct
    session := models.Session{
        ID:          raw.ID,
        ProjectPath: raw.Project,
        Model:       "cursor",  // or detect from config
        Turns:       []models.Turn{},
    }
    
    // Extract turns
    for _, rawTurn := range raw.Turns {
        turn := models.Turn{
            Role:    rawTurn.Role,
            Content: rawTurn.Content,
            Tokens:  rawTurn.Tokens,
        }
        session.Turns = append(session.Turns, turn)
        
        // Aggregate tokens
        if rawTurn.Role == "user" {
            session.InputTokens += rawTurn.Tokens
        } else {
            session.OutputTokens += rawTurn.Tokens
        }
    }
    
    return session, nil
}
```

### Step 4: Implement Watch()

```go
func (a *Adapter) Watch(dirPath string, callback func(models.Session)) error {
    watcher, err := fsnotify.NewWatcher()
    if err != nil {
        return err
    }
    
    // Watch ~/.cursor/sessions/
    cursorPath := filepath.Join(os.ExpandUser("~"), ".cursor", "sessions")
    
    err = watcher.Add(cursorPath)
    if err != nil {
        return err
    }
    
    // Start watching
    go func() {
        defer watcher.Close()
        
        for {
            select {
            case event, ok := <-watcher.Events:
                if !ok {
                    return
                }
                
                // Only process .json files
                if filepath.Ext(event.Name) != ".json" {
                    continue
                }
                
                // Reparse changed file
                session, err := parseSessionFile(event.Name)
                if err != nil {
                    log.Printf("error parsing %s: %v\n", event.Name, err)
                    continue
                }
                
                // Invoke callback (store will update)
                callback(session)
                
            case err, ok := <-watcher.Errors:
                if !ok {
                    return
                }
                log.Println("watch error:", err)
            }
        }
    }()
    
    return nil
}
```

### Step 5: Register the Adapter

In `main.go`, add Cursor support:

```go
import (
    "ai-sessions/internal/adapters/cursor"
    // ... other imports
)

func main() {
    // Create all adapters
    claudeAdapter := claudecode.NewAdapter()
    cursorAdapter := cursor.NewAdapter()
    
    // Load from all sources
    var allSessions []models.Session
    
    sessions, _ := claudeAdapter.Load(os.ExpandUser("~/.claude/projects"))
    allSessions = append(allSessions, sessions...)
    
    sessions, _ := cursorAdapter.Load("")  // Load() handles path internally
    allSessions = append(allSessions, sessions...)
    
    // Create store and load
    store := store.NewStore()
    store.LoadAll(allSessions)
    
    // Watch both sources
    go claudeAdapter.Watch(os.ExpandUser("~/.claude/projects"), func(session models.Session) {
        store.Upsert(&session)
        hub.Broadcast(/* ... */)
    })
    
    go cursorAdapter.Watch("", func(session models.Session) {
        store.Upsert(&session)
        hub.Broadcast(/* ... */)
    })
}
```

### Step 6: Update UI (Optional)

In `web/src/pages/Settings.jsx`, add Cursor status:

```jsx
<div>
  <h2>Cursor</h2>
  <p>Status: <Badge color="green">Enabled</Badge></p>
  <p>Sessions: {systemInfo.cursorSessions || 0}</p>
</div>
```

## Testing Your Adapter

### Unit Tests

Create `internal/adapters/cursor/adapter_test.go`:

```go
package cursor

import (
    "testing"
)

func TestLoad(t *testing.T) {
    adapter := NewAdapter()
    sessions, err := adapter.Load("")
    
    if err != nil {
        t.Fatalf("Load() error: %v", err)
    }
    
    if len(sessions) == 0 {
        t.Log("No Cursor sessions found (expected if Cursor not installed)")
    }
}

func TestParseSessionFile(t *testing.T) {
    // Create a mock session file
    // Parse it
    // Assert structure
}
```

### Integration Test

```bash
# 1. Create fake Cursor sessions
mkdir -p ~/.cursor/sessions
echo '{"id": "test-1", "project": "/tmp/test", "turns": [...]}' > ~/.cursor/sessions/test-1.json

# 2. Run dashboard
go run .

# 3. Verify in UI or API
curl http://localhost:8765/api/sessions | jq '.[] | select(.id == "test-1")'
```

## Common Pitfalls

| Issue | Solution |
|-------|----------|
| Session file format wrong | Double-check tool's actual format by inspecting real files |
| Missing error handling | Return nil session on parse error, log and continue |
| No file watcher | Watch() becomes a no-op, sessions only loaded at startup |
| Hardcoded paths | Use `os.ExpandUser("~")` and `filepath.Join()` for cross-platform |
| Timezone issues | Parse timestamps as time.Time, store UTC |
| Race conditions | Use callback pattern, don't modify store directly |
| Memory leak | Close watcher on shutdown (not critical for small-scale tool) |

## Advanced: Multi-Source Aggregation

Once you have multiple adapters, you might want:

**By source:**
```go
type Session struct {
    Source string  // "claude", "cursor", "copilot"
    // ... other fields
}
```

**UI shows badges:**
```jsx
<Badge color={source === "claude" ? "purple" : "blue"}>
  {source}
</Badge>
```

**API filters by source:**
```
GET /api/sessions?source=cursor
GET /api/sessions?source=claude
GET /api/sessions  // All sources
```

## Next Steps

- **Testing patterns:** [Testing Requirements](Dev-Testing-Requirements)
- **PR submission:** [PR Process](Dev-PR-Process)
- **Architecture:** [System Design Overview](Dev-System-Design-Overview)

## References

- [fsnotify docs](https://pkg.go.dev/github.com/fsnotify/fsnotify)
- [Session model](Dev-Component-Breakdown)
- Claude Code adapter example: `internal/adapters/claudecode/adapter.go`
