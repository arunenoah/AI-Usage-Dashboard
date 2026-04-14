# System Design Overview

High-level architecture and design decisions for the AI Usage Dashboard.

## Why This Architecture?

The dashboard is designed as a **single-binary, event-driven system** optimized for:
- **Local-first operation** — No cloud required, analyzes local Claude files
- **Real-time updates** — WebSocket broadcasts changes instantly
- **Low latency** — In-memory store, no database
- **Multi-source support** — Pluggable adapter interface
- **Self-contained distribution** — Frontend embedded in Go binary

## Layered Architecture

```
┌─────────────────────────────────────┐
│  React Frontend (web/src)           │
│  Pages: Dashboard, Sessions, Settings │
└──────────────────┬──────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   REST API (port 8765)   WebSocket (/ws)
        │                     │
┌───────┴─────────────────────┴─────────┐
│         HTTP Server & Router           │
│        (main.go, api/handlers)         │
└───────────┬─────────────────────────┬──┘
            │                         │
   ┌────────▼────────┐     ┌──────────▼─────────┐
   │ API Layer       │     │ WebSocket Hub      │
   │ (REST handlers) │     │ (ws/hub.go)        │
   └────────┬────────┘     └──────────┬─────────┘
            │                         │
   ┌────────▼─────────────────────────┴──────┐
   │  In-Memory Store                         │
   │  (store/store.go)                        │
   │  ├─ Session map (indexed by ID)          │
   │  ├─ Aggregate stats (daily, totals)      │
   │  └─ Computed insights                    │
   └────────┬──────────────────────────────┬──┘
            │                              │
   ┌────────▼────────┐        ┌────────────▼─────────┐
   │ Adapter Layer   │        │ Filesystem Watcher   │
   │ (adapters/*)    │        │ (watcher/watcher.go) │
   │ ├─ Claude Code  │        │ Watches ~/.claude    │
   │ ├─ Copilot      │        │ Detects changes      │
   │ ├─ Windsurf     │        │ Triggers reload      │
   │ └─ OpenCode     │        │                      │
   └────────┬────────┘        └──────────────────────┘
            │
   ┌────────▼──────────────────┐
   │ Disk (Session JSONL files) │
   │ ~/.claude/projects/*/      │
   │ session-*.jsonl            │
   └───────────────────────────┘
```

## Key Design Decisions

### 1. In-Memory Store (Not a Database)

**Decision:** No persistent database. Everything lives in RAM.

**Why:**
- Startup time: < 1 second for typical session counts (< 5000)
- No setup overhead (no schema, migrations, credentials)
- Simplicity: Single Go struct with a mutex
- Cost: Zero infrastructure

**Trade-off:** Data lost on restart (not a problem since it reloads from disk)

### 2. Adapter Pattern for Multi-Source Support

**Decision:** Pluggable adapter interface for different session sources.

**Why:**
- Claude Code, Copilot, Windsurf, Cursor all store sessions differently
- Adapters handle source-specific parsing logic
- Easy to add new sources without touching core store

**Interface:**
```go
type Adapter interface {
    Load(dirPath string) ([]Session, error)
    Watch(dirPath string, callback func(Session)) error
}
```

### 3. Filesystem Watcher for Live Updates

**Decision:** Use `fsnotify` to detect `.jsonl` changes and reload.

**Why:**
- Live updates without polling
- Session changes visible immediately
- Minimal performance impact
- No message queue needed

**Flow:**
1. Claude writes/updates `~/.claude/projects/*/session-*.jsonl`
2. Watcher detects event
3. Adapter reparses the file
4. Store updates in-memory session
5. WebSocket broadcasts to all connected browsers

### 4. Single Binary Distribution

**Decision:** Build React frontend and embed it in the Go binary.

**Why:**
- No separate deployment steps
- One binary = entire application
- Simple to distribute (Homebrew, direct download)
- Easy installation experience

**Build process:**
```
npm run build → web/dist/
go embed web/dist → main.go
go build → ai-sessions binary
```

### 5. REST + WebSocket Hybrid

**Decision:** REST for complex queries, WebSocket for live updates.

**Why:**
- REST: Standard, stateless, easy to cache, paginate, filter
- WebSocket: Low-latency broadcasts, no polling overhead
- Combined: Best of both worlds

**Example:**
```javascript
// Initial load: REST
const stats = await fetch('/api/stats?days=7');

// Live updates: WebSocket
ws.onmessage = (event) => {
  if (event.data.type === 'session_updated') {
    refreshStats();
  }
};
```

## Data Flow

### Startup Sequence

```
1. main.go
   ├─ Parse env vars (PORT, DEBUG)
   ├─ Create adapter (Claude Code parser)
   ├─ Create store
   ├─ Call store.LoadAll() from ~/.claude/projects/
   │  ├─ Adapter scans directory
   │  ├─ Parses each .jsonl file
   │  ├─ Extracts turns, tokens, tools
   │  └─ Indexes by date/project
   ├─ Start watcher on ~/.claude/projects/
   ├─ Register HTTP routes
   ├─ Register WebSocket endpoint
   └─ Listen on PORT (default 8765)

2. Frontend (React)
   ├─ Connect WebSocket to /ws
   ├─ Fetch /api/stats
   ├─ Render dashboard
   └─ Subscribe to session_updated events
```

### Session Update Sequence

```
1. User runs Claude Code
   └─ Claude writes ~/.claude/projects/{project}/session-*.jsonl

2. Watcher detects fsnotify.Event

3. Adapter.Load() called on that file
   ├─ Parse JSONL
   ├─ Extract turns (user+assistant pairs)
   ├─ Compute token counts
   └─ Return Session struct

4. store.Upsert(session)
   ├─ Update in-memory map[sessionID]*Session
   ├─ Recalculate aggregates (totals, daily metrics)
   └─ Trigger stats refresh

5. ws.Hub.Broadcast("session_updated", {session_id, input_tokens, ...})
   ├─ Send to all connected WebSocket clients

6. Frontend receives event
   ├─ Refresh /api/stats
   ├─ Update KPI cards
   ├─ Refresh charts
   └─ Show "Updated" banner
```

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Startup load (1000 sessions) | ~500ms | Adapters parse .jsonl files |
| Session lookup | O(1) | Hash map by ID |
| Aggregation (daily) | ~10ms | Computed on-demand with caching |
| WebSocket broadcast | <10ms | Fan-out to all connected clients |
| API request (stats) | ~20ms | In-memory calculation + JSON serialization |
| Frontend re-render | ~100ms | React reconciliation + chart update |

## Scalability Limits

The dashboard is optimized for **individual developers**, not teams.

**Comfortable range:**
- Sessions: < 10,000 (typical user: 500-2000)
- Tokens per session: < 100,000
- Memory: < 500 MB

**Beyond that:**
- Store size grows linearly with session count
- In-memory indexing becomes memory-intensive
- Consider database for team/enterprise setups

**Migration path:** Replace `store.go` with a database backend (PostgreSQL, SQLite) without changing API layer.

## Security Considerations

### 1. Local-First by Design

The dashboard only reads from `~/.claude/` on the local machine. No data leaves your device unless you explicitly share.

### 2. Port Binding

By default, the server listens on `localhost:8765`. Only accessible from the same machine.

To expose publicly:
```bash
PORT=0.0.0.0:8765 ./ai-sessions
```

**WARNING:** Not recommended without authentication.

### 3. Session Privacy

Session files contain:
- User prompts (potentially sensitive)
- Claude responses
- Tool calls
- Token counts

All stored locally. The dashboard doesn't upload or track anything.

## Extension Points

### Add a New Adapter

See [Adapter Development Guide](Dev-Adapter-Development-Guide).

### Add a New API Endpoint

Edit `internal/api/handlers.go`:
```go
func NewHandler(store *store.Store) http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/custom", func(w http.ResponseWriter, r *http.Request) {
        // Your logic
        json.NewEncoder(w).Encode(result)
    })
    return mux
}
```

### Add a New Metric

See [Adding New Metrics](Dev-Adding-New-Metrics).

### Add a Frontend Component

See [Component Breakdown](Dev-Component-Breakdown).

## Deployment Topology

### Local Development
```
Developer Machine
├─ Frontend (npm run dev on :5173)
├─ Backend (go run . on :8765)
└─ Claude session files (~/.claude/projects/)
```

### Production (Single Machine)
```
Server Machine
├─ ai-sessions binary
│  ├─ Embedded React UI (/)
│  ├─ REST API (/api/*)
│  └─ WebSocket (/ws)
└─ Claude session files (~/.claude/projects/)
```

### Team/Cloud (Future)
```
Cloud Infrastructure
├─ Kubernetes / Docker
├─ API Server (Go)
├─ Frontend CDN
├─ Session database (PostgreSQL)
└─ Authentication / Authorization
```

## Monitoring & Observability

### Built-in endpoints
- `GET /api/health` — Service health
- `GET /api/system` — Claude config, environment

### Logging
- Backend: `fmt.Println()` style (future: structured logging)
- Frontend: `console.log()` (check DevTools)

### Metrics (Future)
- Prometheus-compatible `/metrics` endpoint
- Request latency tracking
- Error rate monitoring

## Trade-Offs Summary

| Aspect | Choice | Benefit | Cost |
|--------|--------|---------|------|
| Storage | In-memory | Fast, simple | Data lost on restart |
| Adapters | Pluggable | Multi-source | Code duplication |
| Distribution | Single binary | Easy install | Larger download |
| Real-time | WebSocket | Low latency | Connection overhead |
| Auth | None (local) | No complexity | Unsafe if exposed |

## Next Steps

- **Detailed components:** [Component Breakdown](Dev-Component-Breakdown)
- **Data model:** [Data Flow & State Management](Dev-Data-Flow)
- **Extending:** [API Extensions](Dev-API-Extensions), [Adapter Development](Dev-Adapter-Development-Guide)
