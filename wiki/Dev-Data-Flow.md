# Data Flow & State Management

How data flows through the system from disk to UI, and how state is managed.

## Session Lifecycle

### Phase 1: Session Creation (by Claude)

```
Claude Code runs:
  $ claude-code some-task

Claude writes:
  ~/.claude/projects/{project}/session-{id}.jsonl

Each turn appends a line:
  {"role": "user", "content": "...", "tokens": 150, ...}
  {"role": "assistant", "content": "...", "tokens": 300, ...}
```

The JSONL file grows as the conversation continues.

### Phase 2: Disk Detection (Watcher)

```
filesystem event occurs:
  Write to session-{id}.jsonl

fsnotify delivers:
  Event{Op: WRITE, Name: "~/.claude/.../session-123.jsonl"}

Watcher debounces:
  (If another event comes within 100ms, merge them)

Watcher dispatches:
  adapter.Load(session-123.jsonl)
```

### Phase 3: Parsing (Adapter)

```
Adapter reads JSONL:
  [{"role": "user", ...}, {"role": "assistant", ...}]

Extracts fields:
  • Turns (user + assistant pairs)
  • Token counts (per turn)
  • Tool calls (if any)
  • Timestamps
  • Model name

Aggregates into Session struct:
  {
    ID: "session-123",
    ProjectPath: "~/projects/webapp",
    Turns: [{user: ..., assistant: ...}, ...],
    InputTokens: 1500,
    OutputTokens: 2400,
    ToolCalls: {"bash": 3, "read": 2},
    ...
  }

Returns:
  Session struct
```

### Phase 4: Storage (Store)

```
store.Upsert(session) called:
  
Lock store.mu (write lock):
  store.sessions[session.ID] = session
  
Recalculate aggregates:
  store.totalSessions = len(store.sessions)
  store.totalTokens += (session.InputTokens + OutputTokens)
  
  For each session.Turn:
    Update dailyStats[dateString].InputTokens
    Update dailyStats[dateString].OutputTokens
    Update toolStats[toolName].count
  
Release lock:
  Other goroutines can now read

Broadcast event:
  hub.Broadcast(Event{
    Type: "session_updated",
    SessionID: session.ID,
    Payload: {input_tokens: 1500, output_tokens: 2400, ...}
  })
```

### Phase 5: Real-Time Broadcast (WebSocket)

```
Hub.Broadcast() called:
  
For each connected client:
  client.send <- Event{...}

Client.writeLoop() receives:
  Serialize event to JSON
  ws.WriteMessage(websocket.TextMessage, json)

Browser receives via WebSocket:
  onmessage: event => {
    if (event.data.type === "session_updated") {
      // Trigger refresh
    }
  }
```

### Phase 6: API Query (REST)

```
Frontend calls:
  GET /api/stats?days=7

Handler stats(w, r) executes:
  from, to := parseQueryDays(7)
  
  stats := store.GetStats(from, to)
  
  GetStats acquires read lock:
    Loop sessions map:
      If session within [from, to]:
        Accumulate totals
        Add to dailyMetrics[]
    
    Build response:
      {
        total_sessions: 42,
        total_tokens: 150000,
        daily_metrics: [{date: "2026-04-14", input: 5000, output: 3000}, ...],
        top_tools: [{name: "bash", count: 15}, ...],
        output_ratio: 0.67,
        ...
      }

JSON encode:
  w.Header().Set("Content-Type", "application/json")
  json.NewEncoder(w).Encode(stats)

Network send:
  HTTP response body
```

### Phase 7: Frontend Rendering

```
useEffect(() => {
  fetch('/api/stats?days=7')
    .then(r => r.json())
    .then(stats => setStats(stats))
}, [])

setState triggers:
  React.useState({...stats})
  
Component re-renders:
  <KPICard value={stats.total_tokens} />
  <TokenTrendChart data={stats.daily_metrics} />
  
DOM updates:
  Browser renders new values
  Charts animate
  
User sees:
  Updated dashboard with live data
```

## State Management by Layer

### Backend State (Store)

**In-memory:**
```go
type Store struct {
    mu sync.RWMutex  // Protects all below
    
    // Primary data
    sessions map[string]*Session  // ID → Session
    
    // Computed aggregates
    totalSessions int
    totalTokens int
    dailyStats map[string]DailyMetric
    toolStats map[string]ToolMetric
    
    // Cache (invalidated on updates)
    cachedStats *Stats
    cachedInsights *PromptInsight
}
```

**Lifecycle:**
1. Created in `main()`
2. Populated in `store.LoadAll()`
3. Updated on every session change via `Upsert()`
4. Queried by API handlers
5. Destroyed on shutdown (data lost, reloaded from disk next startup)

**Thread safety:**
- All reads: `RLock` (allows parallel reads)
- All writes: `Lock` (exclusive access)
- No two goroutines write simultaneously
- Prevents race conditions in concurrent environment

### Frontend State (React)

**In components:**
```jsx
const [stats, setStats] = useState(null);
const [selectedSession, setSelectedSession] = useState(null);
const [filters, setFilters] = useState({scoreMin: 1, scoreMax: 10});
const [loading, setLoading] = useState(false);
```

**Lifecycle:**
1. Initialize on component mount
2. Fetch from `/api` → update state
3. Listen to WebSocket → trigger refetch → update state
4. User interaction → update local state
5. Cleanup on unmount

**Data flow:**
```
API → useState(data) → component props → render
                ↑
         useEffect [] → fetch
                ↑
         useWebSocket → onmessage → refetch
```

## Aggregation Hierarchy

The store computes statistics at multiple levels:

### Level 1: Session
```go
type Session struct {
    InputTokens int
    OutputTokens int
    ToolCalls map[string]int
    StartTime time.Time
    // ...
}
```
**Scope:** Single conversation

### Level 2: Daily Aggregate
```go
type DailyMetric struct {
    Date string  // "2026-04-14"
    Sessions int
    InputTokens int
    OutputTokens int
    ToolCalls map[string]int
}
```
**Scope:** All sessions in one day

**Computed in store:**
```go
func (s *Store) aggregateDaily() {
    for sessionID, session := range s.sessions {
        dateKey := session.StartTime.Format("2006-01-02")
        daily := s.dailyStats[dateKey]
        daily.InputTokens += session.InputTokens
        daily.OutputTokens += session.OutputTokens
        daily.Sessions++
        // Add tool counts...
    }
}
```

### Level 3: Period Aggregate
```go
type Stats struct {
    TotalSessions int
    TotalTokens int
    OutputRatio float64
    DailyMetrics []DailyMetric
    TopTools []ToolMetric
}
```
**Scope:** All sessions in selected date range

**Computed on-the-fly in API:**
```go
func (s *Store) GetStats(from, to time.Time) Stats {
    s.mu.RLock()
    defer s.mu.RUnlock()
    
    var stats Stats
    for _, session := range s.sessions {
        if session.StartTime.After(from) && session.StartTime.Before(to) {
            stats.TotalSessions++
            stats.TotalTokens += session.InputTokens + session.OutputTokens
            // Aggregate more...
        }
    }
    return stats
}
```

## Conversation Pair Analysis

Special handling for prompt quality insights:

### Creating Conversation Pairs

From a session with multiple turns:
```
Turn 1: User asks "How do I use React hooks?"
        Assistant responds with explanation
        → ConversationPair{UserPrompt: "...", AssistantReply: "...", Tokens: 400}

Turn 2: User asks "Can you show me an example?"
        Assistant responds with code
        → ConversationPair{UserPrompt: "...", AssistantReply: "...", Tokens: 600}
```

### CARE Scoring

Each ConversationPair is scored 1-10:

```
Score components:
  • Context (0-2 pts): File paths, function names, role?
  • Ask (0-3 pts): Action verb, detailed instruction?
  • Rules (0-2 pts): Constraints, boundaries, acceptance criteria?
  • Examples (0-2 pts): Output format, code samples?
  
Total = C + A + R + E (out of 10)

Label:
  1-4:  Weak (missing most dimensions)
  5-6:  Needs Work (has structure but gaps)
  7-8:  Decent (mostly well-structured, minor gaps)
  9-10: Good (comprehensive, actionable, well-scoped)
```

### Insight Computation

From conversation history, compute tier and next-tier goals:

```go
type PromptInsight struct {
    Tier string  // "Beginner" (1-3), "Intermediate" (4-6), "Advanced" (7-8), "Expert" (9-10)
    Score int    // Average score across all conversations
    
    // Per-dimension analysis
    ContextScore int
    AskScore int
    RulesScore int
    ExamplesScore int
    
    // Path to next tier
    NextTierGoals []Goal
    Examples []PromptExample  // Real bad prompts from your sessions, with fixes
}

type Goal struct {
    Dimension string  // "Context", "Ask", "Rules", or "Examples"
    Current int       // Average dimension score
    Target int        // To reach next tier
    Tips []string     // Actionable advice
}

type PromptExample struct {
    BadPrompt string    // What you actually wrote
    Better string       // Improved version
    Explanation string  // Why it's better
    Source SessionID    // Where it came from
}
```

**Example insight:**
```
Tier: Intermediate (score 5.8 average)

Next tier: Advanced (need 7.0+)

Goals:
  - [A] Ask: Currently 1.5/3 → Need 2.5/3
    Tip: Use action verbs (Fix, Refactor, Implement)
    Tip: Break multi-step tasks into numbered list
    Example: You wrote: "Can you look at this bug?"
            Better: "Fix the login form validation on line 42. Check password length requirement."

  - [C] Context: Currently 1.8/2 → Keep high!
    Tip: Include file paths in your prompts
    
  - [R] Rules: Currently 1.0/2 → Need 1.5/2
    Tip: State acceptance criteria
    Example: Add "Ensure tests pass" or "No breaking changes"
```

## Memory Profile

For typical developer:
- 500-2000 sessions (historical)
- ~10-100 turns per session
- ~100-500 tool calls per session

**Memory usage:**
```
Session struct:  ~2-5 KB each
500 sessions:    ~2.5 MB
+ Aggregates:    ~0.5 MB
+ Indexes:       ~1 MB
Total:           ~4 MB
```

**Comfortable range:** < 500 MB (system can handle 50,000+ sessions)

## Optimization Opportunities

### Caching Layer

Add caching to expensive operations:
```go
type Store struct {
    // ... existing fields ...
    
    cachedStats *Stats
    cachedStatsKey string  // Date range key
    statsCacheTTL time.Time
}

func (s *Store) GetStats(from, to time.Time) Stats {
    cacheKey := from.String() + to.String()
    
    // Return cached if valid
    if cacheKey == s.cachedStatsKey && time.Now().Before(s.statsCacheTTL) {
        return *s.cachedStats
    }
    
    // Recompute and cache
    stats := s.computeStats(from, to)
    s.cachedStats = &stats
    s.cachedStatsKey = cacheKey
    s.statsCacheTTL = time.Now().Add(5 * time.Minute)
    
    return stats
}
```

### Database Migration Path

If in-memory becomes limiting, migrate to SQLite/PostgreSQL:

1. Add `database/sql` layer
2. Replace `Store` with DB-backed store
3. API layer unchanged (same interface)
4. Frontend unchanged (same endpoints)

## WebSocket Message Format

### Server → Client

```json
{
  "type": "session_updated",
  "session_id": "session-123",
  "input_tokens": 1500,
  "output_tokens": 2400,
  "project": "/Users/username/projects/webapp",
  "timestamp": "2026-04-14T10:30:00Z"
}
```

### Client → Server (Future)

```json
{
  "type": "request_refresh",
  "target": "stats"
}
```

(Not yet implemented, but message format reserved)

## Next Steps

- **Detailed architecture:** [System Design Overview](Dev-System-Design-Overview)
- **Component interactions:** [Component Breakdown](Dev-Component-Breakdown)
- **Adding new metrics:** [Adding New Metrics](Dev-Adding-New-Metrics)
- **Testing data flow:** [Testing Requirements](Dev-Testing-Requirements)
