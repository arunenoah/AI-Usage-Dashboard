# Component Breakdown

Detailed responsibilities of every major component in the system.

## Backend Components

### main.go — Entry Point & Wiring

**Purpose:** Dependency injection, server startup, graceful shutdown.

**Key functions:**
```go
func main()
    • Parse environment variables (PORT, DEBUG)
    • Create Claude Code adapter
    • Create in-memory store
    • Call store.LoadAll() to load sessions from disk
    • Start filesystem watcher
    • Register HTTP routes and middleware
    • Listen on PORT
```

**Environment variables:**
- `PORT` (default: 8765)
- `DEBUG` (enables verbose logging)

**Responsibilities:**
- Orchestrate startup sequence
- Wire together layers (adapter → store → API)
- Ensure graceful shutdown on SIGINT

### internal/adapters/ — Session Parsing

#### adapter.go — Interface Definition

**Purpose:** Abstract interface for multi-source session support.

**Interface:**
```go
type Adapter interface {
    // Load all sessions from directory
    Load(dirPath string) ([]Session, error)
    
    // Watch directory and call callback on change
    Watch(dirPath string, callback func(Session)) error
}
```

**Why an interface:**
- Claude Code, Copilot, Windsurf store sessions differently
- Each has its own JSONL format, directory structure
- Adapter encapsulates source-specific logic
- New sources added without touching core

#### adapters/claudecode/adapter.go — Claude Code Parser

**Purpose:** Parse Claude Code session JSONL files.

**Input:** `~/.claude/projects/{project}/session-{id}.jsonl`

**Example JSONL line:**
```json
{
  "role": "user",
  "content": "Fix the bug in login.tsx",
  "token_count": 150,
  "timestamp": "2026-04-14T10:30:00Z"
}
```

**Key functions:**
```go
func (a *Adapter) Load(dirPath string) ([]Session, error)
    • Walk ~/.claude/projects/ recursively
    • Find all session-*.jsonl files
    • Parse each file into turns
    • Aggregate metadata (project, token counts, tools)
    • Return Session structs

func (a *Adapter) Watch(dirPath string, callback func(Session)) error
    • Start watching for fsnotify events
    • On change, reparse and callback
```

**Extracts from JSONL:**
- Turns (user + assistant pairs)
- Token counts (input, output)
- Tool calls (function names, arguments)
- Timing (start, end, duration)
- Project path
- Model name (Haiku, Sonnet, Opus)

### internal/store/store.go — In-Memory Database

**Purpose:** Session storage, indexing, aggregation, statistics.

**Core data structure:**
```go
type Store struct {
    mu       sync.RWMutex
    sessions map[string]*Session  // ID → Session
    // Computed aggregates
    totalTokens, totalSessions int
    dailyStats map[string]DailyMetric
}
```

**Key methods:**
```go
func (s *Store) LoadAll(dirPath string) error
    • Call adapter.Load()
    • Insert all sessions
    • Recompute aggregates
    
func (s *Store) Upsert(session *Session) error
    • Update or insert session in map
    • Recalculate stats
    • Trigger WebSocket broadcast
    
func (s *Store) GetStats(from, to time.Time) Stats
    • Aggregate sessions in date range
    • Compute totals, daily breakdowns
    • Return Stats struct for API
    
func (s *Store) GetSession(id string) *Session
    • Lookup session by ID
    • Thread-safe read
    
func (s *Store) GetConversations(limit, offset int) []ConversationPair
    • Extract user→assistant conversation pairs
    • Score each with CARE framework
    • Return paginated results
```

**Responsibilities:**
- Store sessions indexed by ID and date
- Compute aggregate statistics (daily, weekly, total)
- Thread-safe access (RWMutex)
- Expose data via method calls for API layer

**Thread safety:**
- All reads acquire RLock
- All writes acquire Lock
- Prevents race conditions with concurrent API requests

### internal/models/models.go — Data Structures

**Purpose:** Define DTOs (data transfer objects) for backend and API.

**Key structs:**
```go
type Session struct {
    ID              string
    ProjectPath     string
    Model           string
    Turns           []Turn
    InputTokens     int
    OutputTokens    int
    ToolCalls       map[string]int  // Tool name → count
    StartTime       time.Time
    EndTime         time.Time
}

type Turn struct {
    Role       string  // "user" or "assistant"
    Content    string
    Tokens     int
    ToolCalls  []ToolCall
}

type ToolCall struct {
    Name     string
    Args     map[string]interface{}
}

type Stats struct {
    TotalSessions    int
    TotalTokens      int
    OutputRatio      float64  // output / (input + output)
    DailyMetrics     []DailyMetric
    TopTools         []ToolMetric
    ContextHealth    ContextWindow
}

type ConversationPair struct {
    UserPrompt     string
    AssistantReply string
    Tokens         int
    CAREScore      int  // 1-10
    Improvements   []string
}

type PromptInsight struct {
    Tier            string  // "Beginner", "Intermediate", "Advanced", "Expert"
    Score           int
    ContextScore    int  // Per-dimension
    AskScore        int
    RulesScore      int
    ExamplesScore   int
    NextTierGoals   []Goal
    Examples        []PromptExample
}
```

### internal/api/handlers.go — REST API

**Purpose:** HTTP endpoint handlers and response shaping.

**Endpoints:**

```go
GET /api/health
    • Returns {"status": "ok"}
    
GET /api/stats?days=7 (or ?from=YYYY-MM-DD&to=YYYY-MM-DD)
    • Call store.GetStats(from, to)
    • Return Stats{Totals, DailyMetrics, TopTools, ...}
    
GET /api/sessions?page=1&limit=20&project=<substring>
    • Return paginated session list
    • Filter by project name if provided
    • Include metadata (tokens, tools, date)
    
GET /api/sessions/{id}/turns
    • Return detailed turn-by-turn breakdown
    • Include prompt, response, token counts
    
GET /api/conversations?period=week&limit=50&score_min=1&score_max=10
    • Return conversation pairs
    • Score each with CARE framework
    • Filter by score range
    
GET /api/insights?days=7&refresh=1
    • Compute tier, goals, real prompt examples
    • Expensive operation, cached
    
GET /api/tools/{name}/samples
    • Return sample tool calls for given tool
    
GET /api/system
    • Return Claude config, MCP info, task status
    
GET /api/tasks
    • Return aggregated tasks from ~/.claude/todos/

GET /ws (WebSocket upgrade)
    • Upgrade connection
    • Subscribe to session_updated events
```

**Responsibility:** Transform store data into HTTP responses, handle pagination/filtering, validate params.

### internal/ws/hub.go — WebSocket Hub

**Purpose:** Broadcast real-time updates to connected clients.

**Data structure:**
```go
type Hub struct {
    clients   map[*Client]bool
    broadcast chan Event
    register  chan *Client
    mu        sync.RWMutex
}

type Event struct {
    Type      string  // "session_updated"
    SessionID string
    Payload   interface{}
}
```

**Key methods:**
```go
func (h *Hub) Register(client *Client)
    • Add client to registry
    
func (h *Hub) Unregister(client *Client)
    • Remove client (on close)
    
func (h *Hub) Broadcast(event Event)
    • Send to all connected clients
    • Non-blocking channel send
```

**Flow:**
1. Client connects to `/ws`
2. Client registered in hub
3. Client reads messages from WebSocket
4. Hub broadcasts on `session_updated`
5. All clients receive event
6. Clients refresh UI

### internal/watcher/watcher.go — Filesystem Watcher

**Purpose:** Detect changes to session files and trigger reparse.

**Uses:** `fsnotify` library for OS-level file events.

**Key functions:**
```go
func (w *Watcher) Start(dirPath string, callback func(Session)) error
    • Create fsnotify.Watcher
    • Recursively add directories from dirPath
    • Start goroutine to listen for events
    
func (w *Watcher) handleEvent(event fsnotify.Event)
    • Filter for .jsonl files
    • Debounce rapid events
    • Call adapter.Load() for that file
    • Invoke callback with parsed Session
```

**Events monitored:**
- Create: New session file
- Write: Existing session updated
- Remove: Session deleted (rare)

**Debouncing:**
- Write events can fire multiple times rapidly
- Use a timer to batch events within 100ms

## Frontend Components

### web/src/App.jsx — Layout & Router

**Purpose:** Top-level layout, navigation, route definitions.

**Structure:**
```jsx
<App>
  ├─ Header
  │  ├─ Logo
  │  ├─ Nav tabs (Dashboard, Sessions, Settings)
  │  └─ Update banner (WebSocket events)
  ├─ Router
  │  ├─ / → Dashboard
  │  ├─ /sessions → SessionExplorer
  │  └─ /settings → Settings
  └─ Footer
```

**Responsibilities:**
- Set up React Router
- Manage top-level layout
- Display live update banner
- Handle navigation

### web/src/pages/Dashboard.jsx — Main Analytics

**Purpose:** KPI cards, trend charts, heatmap, insights.

**Components used:**
```jsx
<Dashboard>
  ├─ KPICard (Sessions)
  ├─ KPICard (Tokens Used)
  ├─ KPICard (Projects)
  ├─ KPICard (Tool Calls)
  ├─ TokenTrendChart (area chart)
  ├─ TokenHeatmap (7-day grid)
  ├─ PromptScoreInsight (tier + goals)
  └─ ConversationsTable (with CARE scores)
</Dashboard>
```

**State:**
- `stats` — Aggregate data from `/api/stats`
- `insights` — Tier and goals from `/api/insights`
- `dateRange` — Selected time window
- `loading` — Fetch state

**Responsibilities:**
- Fetch and cache stats
- Listen to WebSocket updates
- Re-render on data change

### web/src/pages/Sessions.jsx — Session Explorer

**Purpose:** Searchable, paginated session list with drill-down.

**Components:**
```jsx
<SessionExplorer>
  ├─ SearchBar (search by project/model)
  ├─ Table
  │  ├─ Columns: Date, Project, Model, Tokens, Tools, Source
  │  └─ Rows: Session entries
  ├─ Pagination
  │  ├─ Page selector
  │  └─ Rows-per-page dropdown
  └─ DetailDrawer
     ├─ Session metadata
     ├─ Turn-by-turn breakdown
     ├─ Tool samples
     └─ CARE score ring
```

**State:**
- `sessions` — Paginated list
- `selectedSession` — For detail drawer
- `searchQuery` — Filter by project
- `page`, `limit` — Pagination

**Responsibilities:**
- Fetch paginated sessions from `/api/sessions`
- Search and filter
- Handle detail drawer
- Show conversation pairs

### web/src/pages/Settings.jsx — Configuration

**Purpose:** Adapter status, toggle data sources, export.

**Components:**
```jsx
<Settings>
  ├─ AdapterStatus
  │  ├─ Claude Code (enabled, path, session count)
  │  ├─ Copilot (disabled, ready for setup)
  │  ├─ Windsurf (disabled, stub)
  │  └─ OpenCode (disabled, stub)
  ├─ ExportButton (download sessions as JSON)
  └─ ClearDataButton
```

**Responsibilities:**
- Display adapter status from `/api/system`
- Allow toggling sources (future)
- Export functionality (future)

### web/src/components/ — Reusable Widgets

#### KPICard.jsx

```jsx
<KPICard
  label="Tokens Used"
  value={42500}
  unit="tokens"
  trend="+15%"
  icon={<TokenIcon />}
/>
```

**Props:**
- `label` — Card title
- `value` — Primary metric
- `unit` — Label suffix
- `trend` — % change
- `icon` — SVG icon

#### TokenTrendChart.jsx

```jsx
<TokenTrendChart
  data={[
    { date: "2026-04-14", input: 5000, output: 3000 },
    ...
  ]}
  dateRange={{ from, to }}
/>
```

**Uses Chart.js:** Area chart with dual lines (input/output).

**Interactive:**
- Hover for values
- Date range selection
- Toggle input/output

#### TokenHeatmap.jsx

```jsx
<TokenHeatmap
  data={[
    { date: "2026-04-14", input: 5000, output: 3000 },
    ...
  ]}
/>
```

**Grid of 7 tiles** (last 7 days), color-coded by intensity.

#### PromptScoreInsight.jsx

```jsx
<PromptScoreInsight
  tier="Intermediate"
  score={6}
  contextScore={2}
  askScore={2}
  rulesScore={1}
  examplesScore={1}
  nextTierGoals={[...]}
/>
```

**Features:**
- Tier badge
- CARE score ring
- Per-dimension breakdown
- "Path to Next Tier" with `examples →` links
- Beginner-friendly `?` tooltips

#### ConversationsTable.jsx

```jsx
<ConversationsTable
  conversations={[...]}
  filters={{ scoreMin: 1, scoreMax: 10 }}
  onFilter={setFilters}
/>
```

**Columns:**
- Date
- User prompt (truncated)
- CARE score (color-coded)
- Tools
- Tokens
- Actions (View)

**Color coding:**
- Red: 1-4 (Weak)
- Amber: 5-6 (Needs Work)
- Blue: 7-8 (Decent)
- Green: 9-10 (Good)

#### DetailDrawer.jsx

```jsx
<DetailDrawer
  open={true}
  title="Conversation Detail"
  onClose={close}
>
  {children}
</DetailDrawer>
```

**Slide-over panel** with:
- Full prompt and response
- CARE score ring and tips
- Token breakdown
- Tool calls

#### ToolSamples.jsx

```jsx
<ToolSamples tool="bash" samples={[...]} />
```

**Shows real usage examples:**
- Tool name
- Sample calls (first 3)
- Truncated output

### web/src/hooks/useWebSocket.js

**Purpose:** WebSocket connection and auto-reconnect.

```javascript
const { connected, lastEvent } = useWebSocket('ws://localhost:8765/ws');

// Triggers UI refresh on session_updated
```

**Responsibility:**
- Connect on mount
- Auto-reconnect on disconnect
- Parse messages
- Invoke callbacks

### web/src/api.js

**Purpose:** HTTP client wrapper.

```javascript
export const api = {
  getStats(days) { ... },
  getSessions(page, limit, project) { ... },
  getConversations(period, limit, scoreMin, scoreMax) { ... },
  getInsights(days) { ... },
  getSession(id) { ... },
};
```

**Responsibilities:**
- Centralize API calls
- Error handling
- Request/response logging
- Type hints (JSDoc)

## Data Flow Across Components

### Startup

```
main.go
  ├─ Create Store
  ├─ Adapter.Load()
  ├─ Store.LoadAll()
  └─ API routes + WS

Browser
  ├─ React mounts
  ├─ useWebSocket connects
  ├─ Fetch /api/stats
  ├─ Fetch /api/insights
  └─ Render Dashboard
```

### Live Update

```
Claude writes session JSONL
  ↓
Watcher detects change
  ↓
Adapter.Load() reparses
  ↓
Store.Upsert()
  ↓
Hub.Broadcast("session_updated")
  ↓
Browser WebSocket receives
  ↓
useWebSocket callback fires
  ↓
Dashboard refetch /api/stats
  ↓
Re-render with new data
```

## Component Interaction Matrix

| Backend | Frontend | Via |
|---------|----------|-----|
| Store | Dashboard | `/api/stats` |
| Store | SessionExplorer | `/api/sessions` |
| Store | DetailDrawer | `/api/sessions/{id}/turns` |
| Store | PromptScoreInsight | `/api/insights` |
| Store | ConversationsTable | `/api/conversations` |
| Hub | App | WebSocket `/ws` |
| Adapter | Store | Load() / Watch() |
| Watcher | Hub | Broadcast after Upsert |

## Next Steps

- **Data model details:** [Data Flow & State Management](Dev-Data-Flow)
- **Extending components:** [API Extensions](Dev-API-Extensions)
- **Adding metrics:** [Adding New Metrics](Dev-Adding-New-Metrics)
- **Testing:** [Testing Requirements](Dev-Testing-Requirements)
