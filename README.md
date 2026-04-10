# AI Usage Dashboard (`ai-sessions`)
`ai-sessions` is a local-first analytics dashboard for Claude Code session activity.

It parses Claude session JSONL files from `~/.claude/projects/`, computes usage/cost/productivity metrics, and serves a React dashboard with live updates over WebSocket.

## What it does
- Loads historical Claude Code sessions into an in-memory store.
- Aggregates token, cost, tool, project, and daily activity metrics.
- Streams near-real-time updates when session files change.
- Exposes REST APIs for dashboard data and detailed drill-down views.
- Serves a React + Vite UI from the same Go binary.

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
