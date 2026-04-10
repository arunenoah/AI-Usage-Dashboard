# AI Usage Dashboard (`ai-sessions`)
`ai-sessions` is a local-first analytics dashboard for Claude Code session activity.

It parses Claude session JSONL files from `~/.claude/projects/`, computes usage/cost/productivity metrics, and serves a React dashboard with live updates over WebSocket.

## What it does
- Loads historical Claude Code sessions into an in-memory store.
- Aggregates token, cost, tool, project, and daily activity metrics.
- Streams near-real-time updates when session files change.
- Exposes REST APIs for dashboard data and detailed drill-down views.
- Serves a React + Vite UI from the same Go binary.

## Who this helps
This dashboard is useful for:
- **Individual developers** who want to understand AI usage, token burn, and cost over time.
- **Power users of Claude Code** who want to improve prompt quality and session hygiene.
- **Tech leads / engineering managers** who need visibility into usage patterns, project focus, and productivity windows.
- **Anyone optimizing AI spend** who wants to track cache efficiency and reduce repeated context costs.

## Widget ideas this dashboard gives you
If you are building your own analytics UI, this project shows practical widget patterns you can reuse:
- **KPI cards**: sessions, total spend, output tokens, cache efficiency.
- **Token trend chart**: cache vs input/output views, with date-range toggles.
- **Session explorer table**: searchable session list plus detail drawer.
- **Tool usage panel**: top tools with clickable sample drill-down.
- **Hourly activity chart**: peak coding/agent activity by hour.
- **Conversation breakdown table**: prompt/response previews with output, context %, cost, and time.
- **Context health panel**: context-window fill tracking with warning states.
- **Prompt insights card**: actionable suggestions to reduce token waste and improve quality.
- **Live update banner**: real-time feedback when new session data arrives.

## Dashboard screenshots (with explanation)
### 1) Dashboard overview
Shows the global period filter, live session banner, top KPI cards, and token trend chart for quick usage/cost monitoring.
![Dashboard overview](docs/images/dashboard-overview.png)

### 2) Session Explorer + Prompt Insights
Shows the searchable/paginated session table on the left and prompt quality insights with actionable optimization hints on the right.
![Session Explorer and Prompt Insights](docs/images/session-explorer-and-prompt-insights.png)

### 3) Session Detail drawer
Shows per-session deep dive data (turn timeline, token breakdown, tool calls, estimated cost) opened from Session Explorer.
![Session Detail drawer](docs/images/session-detail-drawer.png)

### 4) Tool Usage, Hourly Activity, and Conversations
Shows behavioral analytics widgets: tool distribution, productivity by hour, and recent conversation summaries with token/cost context.
![Tool Usage, Hourly Activity, and Conversations](docs/images/tool-usage-activity-and-conversations.png)

### 5) Tool sample details drawer
Shows drill-down for a selected tool (example: `Read`) with recent sampled calls to understand usage patterns.
![Tool samples drawer (Read)](docs/images/tool-samples-drawer-read.png)

### 6) Conversation Detail drawer
Shows turn-level conversation analysis including billed token categories, context-window usage, cost, latency, and full assistant response.
![Conversation Detail drawer](docs/images/conversation-detail-drawer.png)

### 7) Context Health + Claude Code Config
Shows session context-fill health and system-level Claude usage/config overview (projects, session files, plugins, MCP servers).
![Context Health and System Info](docs/images/context-health-and-system-info.png)

## Tech stack
- Backend: Go (`net/http`, `embed`)
- Realtime: `gorilla/websocket`
- File watching: `fsnotify`
- Frontend: React 18, React Router, Vite
- Charts: Chart.js

## Architecture overview
This project follows a **single-binary, layered architecture**:

1. **Adapter layer** (`internal/adapters/*`)
   - Detects and parses source session files.
   - Current implementation: Claude Code adapter.
2. **Store layer** (`internal/store`)
   - In-memory indexed session store.
   - Computes aggregate statistics and time-windowed summaries.
3. **API layer** (`internal/api`)
   - HTTP handlers for stats, sessions, system, and conversation APIs.
4. **Realtime layer** (`internal/ws`, `internal/watcher`)
   - Filesystem watcher detects `.jsonl` changes.
   - WebSocket hub broadcasts update events to connected clients.
5. **UI layer** (`web/src`)
   - React SPA consuming REST + WebSocket.
   - Build output embedded into Go binary and served as static assets.

## Runtime flow
### Startup
1. `main.go` creates:
   - Claude adapter
   - in-memory store
   - WebSocket hub
2. Store performs initial full load (`LoadAll`) from `~/.claude/projects/`.
3. Watcher starts recursive file monitoring on the same directory.
4. API routes and `/ws` endpoint are registered.
5. Embedded `web/dist` is served at `/`.

### Live updates
1. Claude writes/updates a session `.jsonl`.
2. `internal/watcher` receives fsnotify event.
3. Updated file is reparsed through adapter.
4. Store upserts session.
5. Hub broadcasts a `session_updated` event.
6. Frontend hook (`useWebSocket`) refreshes stats/sessions in UI.

## Component responsibilities
### Backend
- `main.go`
  - Dependency wiring, startup load, watcher startup, route registration, embedded static serving.
- `internal/adapters/adapter.go`
  - Adapter abstraction for multi-source support.
- `internal/adapters/claudecode/adapter.go`
  - Session discovery and parsing logic for Claude JSONL files.
  - Extracts turns, token usage, tool calls, timing, metadata.
- `internal/store/store.go`
  - Thread-safe in-memory session map.
  - Aggregation logic: totals, daily metrics, cost estimation, active session detection.
- `internal/api/handlers.go`
  - REST endpoints and response shaping.
  - Adds pagination/filtering and detailed views (session turns, tool samples, conversations).
- `internal/ws/hub.go`
  - WebSocket client registry and fan-out broadcast.
- `internal/watcher/watcher.go`
  - Recursive watch registration + update event handling.
- `internal/models/models.go`
  - Core DTO/domain structs for parser, store, API, and frontend payload contracts.

### Frontend
- `web/src/App.jsx`
  - Layout + route shell.
- `web/src/pages/Dashboard.jsx`
  - Main analytics page with metrics, charts, and live updates.
- `web/src/pages/Sessions.jsx`
  - Session explorer.
- `web/src/pages/Settings.jsx`
  - Adapter configuration/status surface.
- `web/src/hooks/useWebSocket.js`
  - Connection/reconnect logic for `/ws` updates.
- `web/src/components/*`
  - Presentation cards, charts, tables, and drill-down UI.

## Data model highlights
- `Session`: parsed unit from one JSONL file (tokens, turns, tool usage, timing, project path, model).
- `Stats`: aggregated metrics for selected date windows and totals.
- `ConversationPair`: user→assistant paired turns with cost/context calculations.
- `SystemInfo`: metadata pulled from Claude local config/cache folders.

## API reference
Base URL: `http://localhost:8765`

- `GET /api/health`
  - Service health probe.
- `GET /api/stats?days=N`
  - Aggregate stats for relative date range.
- `GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Aggregate stats for explicit date range.
- `GET /api/sessions?page=1&limit=20&project=<substring>`
  - Paged session list with optional project filter.
- `GET /api/sessions/:id/turns`
  - Session metadata + parsed turn details.
- `GET /api/tools/:name/samples`
  - Tool usage samples across sessions.
- `GET /api/history?days=N&limit=N`
  - Recent entries from `~/.claude/history.jsonl`.
- `GET /api/system`
  - Local Claude environment metadata and usage summary.
- `GET /api/conversations?period=today|week|month|all&limit=N`
  - User→assistant conversation pairs.
- `GET /api/image?path=<absolute-path>`
  - Serves image files under `~/.claude/image-cache` only.

## WebSocket events
Endpoint: `/ws`

Current event type:
- `session_updated`
  - Payload includes:
    - `session_id`
    - `input_tokens`
    - `project_dir`

## Project structure
```text
.
├── main.go
├── internal/
│   ├── adapters/
│   │   ├── adapter.go
│   │   └── claudecode/adapter.go
│   ├── api/handlers.go
│   ├── models/models.go
│   ├── store/store.go
│   ├── watcher/watcher.go
│   └── ws/hub.go
├── web/
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── hooks/useWebSocket.js
│   │   ├── pages/
│   │   └── components/
│   └── dist/
└── Makefile
```

## Prerequisites
- Go (version compatible with `go.mod`)
- Node.js + npm (for frontend build/dev)
- Claude local data directory available at `~/.claude`

## Local development
### 1) Frontend dev server
```bash
cd web
npm install
npm run dev
```

### 2) Backend server (separate terminal)
```bash
go run .
```

Frontend proxy (Vite) forwards:
- `/api` → `http://localhost:8765`
- `/ws` → `ws://localhost:8765`

## Production-style local run
Build frontend + backend binary:
```bash
make build
```

Run:
```bash
./ai-sessions
```

Default URL: `http://localhost:8765`  
Change port with:
```bash
PORT=9000 ./ai-sessions
```

## Testing
Run all Go tests:
```bash
make test
```
or
```bash
go test ./...
```

## Notes
- This app is local-first and reads from your local Claude data folders.
- Cost estimates are derived from token accounting logic in `internal/store` and API conversation computations.
- Adapter interface is designed for future sources (Cursor/Copilot/Windsurf stubs already reflected in UI).
