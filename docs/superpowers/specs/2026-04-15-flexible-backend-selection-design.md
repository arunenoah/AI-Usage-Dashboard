# Flexible Backend Selection Design
**Date:** 2026-04-15  
**Status:** Design Approved  
**Effort Level:** Medium

---

## Summary

Add support for users to choose between Go or NodeJS backend during installation. Both backends will implement identical functionality, share the React frontend, and use a JSON Schema as the single source of truth for all data models. Users select their backend once via a config file and only that backend is installed and run—never both simultaneously.

---

## Goals

1. **Backend flexibility:** Users can choose Go or NodeJS based on their preference/deployment environment
2. **Zero impact on existing Go:** Current Go implementation remains unchanged and fully functional
3. **Type safety across languages:** JSON Schema ensures data structures are identical in both backends
4. **Single frontend:** React app is built once and served by either backend
5. **Clean installation:** Users only download and install their chosen backend, not both

---

## Architecture

### Directory Structure

```
AI-Usage-Dashboard/
├── backend.config.json          # User backend choice
├── web/                         # React frontend (unchanged)
│   ├── src/
│   ├── dist/                    # Built output (shared by both backends)
│   ├── package.json
│   └── vite.config.js
├── backends/
│   ├── go/                      # Existing Go backend (no changes)
│   │   ├── main.go
│   │   ├── internal/
│   │   │   ├── adapters/
│   │   │   ├── api/
│   │   │   ├── models/
│   │   │   ├── store/
│   │   │   ├── watcher/
│   │   │   └── ws/
│   │   ├── go.mod
│   │   └── go.sum
│   └── nodejs/                  # New NodeJS backend (mirrors Go)
│       ├── src/
│       │   ├── adapters/        # claudecode, copilot, opencode, windsurf parsers
│       │   ├── api/             # HTTP handlers
│       │   ├── store/           # Session storage
│       │   ├── types/           # Generated TypeScript types
│       │   ├── watcher/         # File system watcher
│       │   ├── ws/              # WebSocket hub
│       │   └── server.ts        # Express server entry point
│       ├── package.json
│       ├── tsconfig.json
│       └── jest.config.js       # Testing config
├── schemas/
│   └── models.schema.json       # Single source of truth for data structures
└── scripts/
    ├── setup.sh                 # Installation script (reads backend.config.json)
    ├── start.sh                 # Start script (runs chosen backend)
    ├── gen-go-types.go          # Generate Go types from schema
    └── gen-node-types.sh        # Generate TypeScript types from schema
```

### Installation & Runtime Flow

**Phase 1: Initial Setup**

1. User clones repository
2. User creates `backend.config.json` in project root:
   ```json
   {
     "backend": "nodejs",
     "port": 8765
   }
   ```
   (or `"backend": "go"`)

3. User runs: `npm run setup`
   - Script reads `backend.config.json`
   - Installs web dependencies: `cd web && npm install`
   - Builds React frontend: `npm run build`
   - If backend is "nodejs": installs Node backend deps (`cd backends/nodejs && npm install`)
   - If backend is "go": skips Node installation (Go binary already compiled or will be compiled on first start)

**Phase 2: Runtime**

1. User runs: `npm run start`
   - Script reads `backend.config.json`
   - If backend is "nodejs": runs `node backends/nodejs/dist/server.js`
   - If backend is "go": runs `./main` (or `go run main.go` in dev)
   - Backend serves React frontend from `web/dist/` on configured port

**Phase 3: Switching Backends (Rare)**

1. User edits `backend.config.json` to change backend
2. User runs `npm run setup` again (installs new backend, keeps web dist)
3. User runs `npm run start` (starts new backend)

### Data Models: JSON Schema

Create `/schemas/models.schema.json` as the single source of truth:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Sessions Data Models",
  "definitions": {
    "ConversationPair": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "prompt": { "type": "string" },
        "response": { "type": "string" },
        "model": { "type": "string" },
        "timestamp": { "type": "integer" }
      },
      "required": ["id", "prompt", "response"]
    },
    "DailyStats": {
      "type": "object",
      "properties": {
        "date": { "type": "string" },
        "sessions": { "type": "integer" },
        "totalTokens": { "type": "integer" },
        "totalCost": { "type": "number" }
      },
      "required": ["date"]
    },
    "Session": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "projectDir": { "type": "string" },
        "source": { "enum": ["claude-code", "github-copilot", "opencode", "windsurf"] },
        "startTime": { "type": "integer" },
        "endTime": { "type": "integer" },
        "conversations": { "type": "array", "$ref": "#/definitions/ConversationPair" }
      },
      "required": ["id", "projectDir", "source"]
    }
  }
}
```

**Type Generation:**

- **Go:** Use `go run scripts/gen-go-types.go` to generate Go structs in `backends/go/internal/models/models.go`
  - Tool: Custom script using `schema-to-go` or similar
  - Output: Struct definitions with JSON tags for marshaling

- **NodeJS:** Use `npx json-schema-to-typescript` to generate TypeScript types in `backends/nodejs/src/types/models.ts`
  - Command: `npx json-schema-to-typescript schemas/models.schema.json --output backends/nodejs/src/types/models.ts`
  - Developers update `schemas/models.schema.json` first, then regenerate types in both backends

---

## NodeJS Backend Implementation

### Module Structure (1:1 with Go)

| Go Module | NodeJS Equivalent | Purpose |
|-----------|------------------|---------|
| `internal/adapters/{claudecode,copilot,opencode,windsurf}` | `src/adapters/{claudecode,copilot,opencode,windsurf}` | Parse IDE/tool session logs |
| `internal/api/handlers.go` | `src/api/handlers.ts` | HTTP request handlers |
| `internal/store/store.go` | `src/store/store.ts` | In-memory session storage |
| `internal/watcher/watcher.go` | `src/watcher/watcher.ts` | File system monitoring |
| `internal/ws/hub.go` | `src/ws/hub.ts` | WebSocket connection hub |
| `internal/models/models.go` | `src/types/models.ts` | Generated from schema |

### Key Implementation Details

#### Adapters
- Read session logs from `~/.claude/projects/`, VS Code storage, etc. (same paths as Go)
- Parse JSON/binary formats into standardized data structures
- Output: Array of `Session` objects matching schema

#### API (Express.js)
- Endpoints identical to Go version:
  - `GET /api/stats` - daily statistics
  - `GET /api/sessions` - list sessions with pagination
  - `GET /api/sessions/:id` - session detail
  - `GET /api/tools/:sessionId` - tool usage samples
  - `GET /api/system` - system info
  - `GET /api/history` - conversation history
  - `GET /api/conversations` - recent conversations
  - `GET /api/insights` - usage insights
  - `GET /api/image` - serve images
  - `GET /api/health` - health check
  - `POST /api/tasks` - task data (GitHub Copilot)

#### Store
- In-memory session storage (same as Go)
- Methods:
  - `loadAll(adapters)` - load sessions from all adapter sources
  - `sessions()` - get all sessions
  - `sessionsBySource(source)` - filter by source
  - `statsForDays(days)` - aggregate stats
  - `statsForRange(from, to)` - date range stats

#### Watcher
- Use `chokidar` npm package (equivalent to `fsnotify`)
- Watch `~/.claude/projects/`, VS Code workspace storage, Windsurf dirs
- On file change: reload relevant session data via adapter
- Emit updates to WebSocket hub

#### WebSocket Hub
- Use `ws` npm package (equivalent to `gorilla/websocket`)
- Route: `GET /ws`
- Broadcast session updates to all connected clients in real-time

### Package.json Dependencies

```json
{
  "name": "ai-sessions-nodejs",
  "version": "1.0.0",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/server.ts",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "express": "^4.18.0",
    "chokidar": "^3.5.0",
    "ws": "^8.13.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "json-schema-to-typescript": "^13.0.0"
  }
}
```

---

## Root-Level Setup

### backend.config.json Structure

```json
{
  "backend": "nodejs",
  "port": 8765
}
```

**Validation:**
- `backend` must be "go" or "nodejs"
- `port` must be a valid port number (1-65535)
- Config file is required before running setup/start

### Root package.json Changes

Current root `package.json` manages only the web frontend. Add convenience scripts:

```json
{
  "scripts": {
    "setup": "node scripts/setup.js",
    "start": "node scripts/start.js",
    "dev": "node scripts/dev.js",
    "build:web": "cd web && npm run build",
    "test:web": "cd web && npm run test",
    "test:backend": "node scripts/test-backend.js"
  }
}
```

Each script reads `backend.config.json` and delegates to the appropriate backend.

### Setup Script Flow (Node.js)

File: `/scripts/setup.js`

```javascript
const fs = require('fs');
const { execSync } = require('child_process');

// Read backend choice
const config = JSON.parse(fs.readFileSync('backend.config.json', 'utf8'));
const backend = config.backend;

if (!['go', 'nodejs'].includes(backend)) {
  console.error('Invalid backend in backend.config.json. Must be "go" or "nodejs"');
  process.exit(1);
}

console.log(`Setting up with backend: ${backend}`);

// Install web dependencies & build
console.log('Building web frontend...');
execSync('cd web && npm install && npm run build', { stdio: 'inherit' });

// Install backend dependencies
if (backend === 'nodejs') {
  console.log('Installing NodeJS backend...');
  execSync('cd backends/nodejs && npm install && npm run build', { stdio: 'inherit' });
} else {
  console.log('Go backend selected. No setup needed (compile on first run).');
}

console.log('✓ Setup complete!');
console.log(`Run 'npm start' to start the ${backend} backend.`);
```

### Start Script Flow (Node.js)

File: `/scripts/start.js`

```javascript
const fs = require('fs');
const { spawn } = require('child_process');

// Read backend choice
const config = JSON.parse(fs.readFileSync('backend.config.json', 'utf8'));
const backend = config.backend;
const port = config.port || 8765;

// Verify web/dist exists
if (!fs.existsSync('web/dist')) {
  console.error('web/dist not found. Run "npm run setup" first.');
  process.exit(1);
}

console.log(`Starting ${backend} backend on port ${port}...`);

if (backend === 'nodejs') {
  spawn('node', ['backends/nodejs/dist/server.js'], {
    env: { ...process.env, PORT: port },
    stdio: 'inherit'
  });
} else {
  spawn('./main', [], {
    env: { ...process.env, PORT: port },
    stdio: 'inherit'
  });
}
```

---

## API Contract

Both backends expose identical REST API:

### GET /api/stats
Query params: `from`, `to`, `days`  
Response: `{ daily: DailyStats[], summary: { totalSessions, totalTokens, totalCost } }`

### GET /api/sessions
Query params: `page`, `limit`, `project`  
Response: `{ sessions: Session[], total: number, page: number }`

### GET /api/sessions/:id
Response: `Session` (full detail)

### GET /api/tools/:sessionId
Response: `{ tools: ToolUsage[] }`

### WebSocket /ws
Bidirectional: Backend broadcasts session updates in real-time

---

## Testing Strategy

### Web Frontend Tests (Unchanged)
- Continue using existing Jest/Vitest setup
- Tests run against both backends (no backend-specific logic in frontend)

### Go Backend Tests (Unchanged)
- Existing test suite: `internal/api/handlers_test.go`, `internal/store/store_test.go`, etc.
- No modifications required

### NodeJS Backend Tests (New)
- **Unit tests:** Jest with `ts-jest`
  - Test each module (adapters, api, store, watcher, ws) in isolation
  - Mock dependencies (file system, network)
  - Mirror test coverage of Go implementation

- **Integration tests:** Test full flow (adapter → store → API)
  - Load sample session files, verify API responses match schema

- **End-to-end tests:** Shared test suite
  - Run same test against both backends
  - Verify API responses are identical

### Test Organization
```
backends/nodejs/
├── src/
├── __tests__/
│   ├── unit/
│   │   ├── adapters.test.ts
│   │   ├── store.test.ts
│   │   └── ...
│   ├── integration/
│   │   └── api.test.ts
│   └── fixtures/
│       └── sample-sessions/
```

---

## Development Workflow

### First-Time Setup
```bash
# Create backend choice (one time)
echo '{ "backend": "nodejs" }' > backend.config.json

# Install everything
npm run setup

# Start the backend
npm run start
# Output: "ai-sessions running -> http://localhost:8765"
```

### Daily Development
```bash
# Start (backend choice already configured)
npm run start

# In another terminal: develop frontend
cd web
npm run dev
```

### Switching Backends (Rare)
```bash
# Edit config
echo '{ "backend": "go" }' > backend.config.json

# Reinstall (if needed)
npm run setup

# Start new backend
npm run start
```

### Running Tests
```bash
# Frontend only
npm run test:web

# Backend only (runs whichever is configured)
npm run test:backend

# All
npm run test
```

---

## Zero Impact on Existing Go

1. **Go code:** Zero changes to `backends/go/` or `main.go`. Go implementation is production-ready as-is.
2. **Backwards compatibility:** If user doesn't create `backend.config.json`, default to Go (or prompt user).
3. **Deployment:** Go can be deployed standalone without any Node files or dependencies.
4. **Existing workflows:** Developers working on Go backend see no changes to their workflow.

---

## Type Safety: Schema-First Development

When adding new features:

1. **Update schema first:** Edit `schemas/models.schema.json`
2. **Regenerate types:**
   ```bash
   npm run gen-types
   # Regenerates both backends/go/internal/models/models.go
   # and backends/nodejs/src/types/models.ts
   ```
3. **Implement feature in both backends** using updated types
4. **Run tests** to verify both backends handle new types correctly

---

## Deployment Scenarios

### Scenario 1: Deploy Go Backend Only
```bash
# No Node dependencies needed
# Just build Go binary and deploy
go build -o ai-sessions main.go
./ai-sessions
```

### Scenario 2: Deploy NodeJS Backend Only
```bash
# No Go binary needed
# Install Node, npm install, npm start
npm run setup  # with backend: "nodejs"
npm start
```

### Scenario 3: Docker
```dockerfile
# Multi-stage build
FROM golang:1.26 as go-builder
WORKDIR /app
COPY backends/go .
RUN go build -o ai-sessions main.go

FROM node:20 as node-builder
WORKDIR /app
COPY backends/nodejs .
RUN npm install && npm run build

# Runtime container (choose one)
FROM alpine
COPY --from=go-builder /app/ai-sessions /app/
CMD ["/app/ai-sessions"]

# OR

FROM node:20-alpine
COPY --from=node-builder /app/dist /app/dist
CMD ["node", "/app/dist/server.js"]
```

---

## Migration Path for Existing Users

For users currently running the Go backend:

1. **No action required.** Go backend continues to work unchanged.
2. **Optional:** To use NodeJS backend, create `backend.config.json` and run `npm run setup` again.
3. **Rollback:** Change `backend.config.json` back to `"go"` and restart.

---

## Success Criteria

- [x] Users can choose backend via `backend.config.json`
- [x] Only chosen backend is installed (no bloat)
- [x] Both backends serve identical API
- [x] Web frontend is shared and built once
- [x] Go backend is unchanged (zero impact)
- [x] Schema-driven types ensure consistency
- [x] Setup and start scripts handle both backends transparently
- [x] Testing strategy covers both backends
- [x] Documentation is clear for backend selection

---

## Next Steps

1. **Implement:** Create Node backend structure and modules
2. **Verify:** Test both backends against same test suite
3. **Document:** Add backend selection to README and installation guide
4. **Deploy:** Release both options to users
