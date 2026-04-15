# AI Usage Dashboard (`ai-sessions`)

`ai-sessions` is a local-first analytics dashboard for Claude Code session activity. It parses Claude session JSONL files from `~/.claude/projects/`, computes usage and productivity metrics, and serves a React dashboard with live updates over WebSocket.

**[📖 Full Documentation](wiki/Home.md)** — User guides, developer docs, and troubleshooting

## What it does

- Loads historical Claude Code sessions into an in-memory store.
- Scores every prompt using the **CARE framework** (Context, Ask, Rules, Examples) on a 1-10 scale.
- Aggregates token, tool, project, and daily activity metrics.
- Streams near-real-time updates when session files change.
- Exposes REST APIs for dashboard data and detailed drill-down views.
- Serves a React + Vite UI from the same Go binary.

## Dashboard Sections

| Section | What it shows |
|---|---|
| **Stat Cards** | Sessions, tokens, projects, tool calls at a glance |
| **By Project** | Cost and session count per project directory |
| **By Model** | Output tokens and cost broken down by Claude model (Sonnet, Opus, Haiku) |
| **By Activity** | Sessions classified by work type — Coding, Debugging, Feature Dev, Exploration, Refactoring, Testing, Delegation |
| **Token Chart** | Daily input/output token usage over the selected date range |
| **Tool Usage** | Top tools with clickable drill-down into sample inputs |
| **Hourly Activity** | When you're most productive (24-hour bar chart) |
| **Shell Commands** | Top CLI commands extracted from Bash tool calls |
| **MCP Servers** | Tool call counts grouped by MCP server name |
| **Conversations** | Recent user→assistant pairs with CARE prompt scores |
| **Context Health** | Active session context usage |
| **Tasks** | Aggregated task status across all projects |
| **Session Explorer** | Paginated session table with detail drawer |
| **Prompt Score** | CARE score distribution and quality breakdown |

All sections respond to the global date filter (Today / 7 Days / 1 Month / Custom / All).

## Quick Start

### Prerequisites

- **Node.js 16+** (required for both backends and the web UI)
- **Go 1.18+** (only if using the Go backend)

### Step 1 — Choose your backend

Create `backend.config.json` in the project root:

**Option A: Node.js backend** (recommended for most users)
```bash
echo '{ "backend": "nodejs" }' > backend.config.json
```

**Option B: Go backend** (lower memory, faster startup, requires Go installed)
```bash
echo '{ "backend": "go" }' > backend.config.json
```

| | Go | Node.js |
|---|---|---|
| Requires | Go 1.18+ | Node.js 16+ only |
| Startup | Fast | Moderate |
| Memory | Low (~10 MB) | Moderate |
| Recommended for | Power users / CI | Most users |

### Step 2 — Install and start

```bash
npm run setup   # installs chosen backend + builds the React UI
npm start       # starts the backend server
```

Open your browser to `http://localhost:8765`

### Switching backends later

Edit `backend.config.json`, then re-run:

```bash
npm run setup
npm start
```

See [Backend Selection Guide](./docs/BACKEND_SELECTION.md) for full comparison and troubleshooting.

## Tech stack

- **Backend (Go):** `net/http`, `embed`, `gorilla/websocket`, `fsnotify`
- **Backend (Node.js):** Express, TypeScript, `ws`, `chokidar`
- **Frontend:** React 18, React Router, Vite, Chart.js

## Architecture overview

The dashboard follows a **single-binary, layered architecture**:

1. **Adapter layer** — Multi-source session parsers (Claude Code, Copilot)
2. **Store layer** — In-memory indexed session store with aggregation
3. **API layer** — REST endpoints with pagination and filtering
4. **WebSocket layer** — Real-time updates via hub broadcast
5. **UI layer** — React SPA consuming REST + WebSocket

For a detailed breakdown, see [System Design Overview](wiki/Dev-System-Design-Overview.md) in the wiki.

## Local Development

### Frontend dev server
```bash
cd web
npm install
npm run dev
```

### Backend server (separate terminal)
```bash
go run .
```

Frontend proxy (Vite) forwards `/api` and `/ws` to `http://localhost:8765`.

See [Local Development Setup](wiki/Dev-Local-Development-Setup.md) for full details.

## API Reference

Base URL: `http://localhost:8765`

**Health & Stats**
- `GET /api/health` — Service health probe
- `GET /api/stats?days=N` — Aggregate stats for relative date range
- `GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` — Aggregate stats for explicit date range
- `GET /api/stats/by-project?days=N` — Cost + session count per project directory
- `GET /api/stats/by-model?days=N` — Output tokens + cost per Claude model
- `GET /api/stats/by-activity?days=N` — Session counts classified by work type
- `GET /api/shell-commands?days=N` — Top CLI commands from Bash tool samples
- `GET /api/mcp-servers?days=N` — Tool call counts grouped by MCP server name

**Sessions**
- `GET /api/sessions?page=1&limit=20&project=<substring>` — Paged session list with optional project filter
- `GET /api/sessions/:id/turns` — Session metadata + parsed turn details

**Conversations & Scoring**
- `GET /api/conversations?period=today|week|month|all&limit=N&page=P&score_min=1&score_max=10` — User→assistant pairs with CARE scores

**Insights & Analysis**
- `GET /api/insights?days=N&refresh=1` — Prompt quality tier, per-dimension analysis, next-tier goals, peer benchmarks

**Tools & System**
- `GET /api/tools/:name/samples` — Tool usage samples
- `GET /api/system` — Claude environment metadata and usage
- `GET /api/tasks` — Aggregated task status
- `GET /api/history?days=N&limit=N` — Recent entries from `~/.claude/history.jsonl`
- `GET /api/image?path=<absolute-path>` — Image files under `~/.claude/image-cache`

## WebSocket Events

Endpoint: `/ws`

- `session_updated` — Broadcast when a session file changes
  - Payload: `{ session_id, input_tokens, project_dir }`

## Contributing

Found a bug or want to add a feature? Check out the [Contributing Guide](wiki/Dev-PR-Process.md) in the wiki.

The project is organized into:
- **Go backend** (`internal/`, `main.go`) — Adapters, store, API handlers, WebSocket
- **Node.js backend** (`backends/nodejs/src/`) — TypeScript port of the Go backend
- **React frontend** (`web/src/`) — Dashboard UI, pages, components, hooks

See [Developer Quick Start](wiki/Dev-Getting-Started-Quick-Start.md) to get set up for contributing.

## Notes

- **Local-first:** This app reads from your local Claude data folder at `~/.claude`
- **Session scoring:** The CARE framework (Context, Ask, Rules, Examples) is computed server-side per conversation. Scores are strict to challenge you to improve
- **Token focus:** Dashboard shows token consumption, not cost estimates (most users are on subscription plans)
- **Multi-source:** The adapter interface supports Claude Code, GitHub Copilot, and is ready for Cursor, Windsurf, and more
