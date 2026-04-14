# Local Development Setup

Complete guide to set up a productive development environment for the AI Usage Dashboard.

## Environment Setup

### macOS/Linux

```bash
# Install Go (if not installed)
brew install go
go version  # Should show 1.18+

# Install Node.js (if not installed)
brew install node
node --version  # Should show 16+
npm --version
```

### Windows

- Download [Go](https://go.dev/dl) — run installer
- Download [Node.js](https://nodejs.org) — run installer
- Restart terminal/IDE for PATH updates

## Repository Setup

```bash
# Clone
git clone https://github.com/arunenoah/AI-Usage-Dashboard.git
cd AI-Usage-Dashboard

# Verify structure
ls -la internal/
ls -la web/
```

## Backend (Go)

### 1. Prepare Dependencies
```bash
go mod download
go mod verify
```

### 2. Code Editor Setup (VS Code)

Install extensions:
- **Go** (golang.go)
- **Go Nightly** (golang.go-nightly) for latest features

Settings:
```json
{
  "[go]": {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": true
    }
  },
  "go.lintOnSave": "package",
  "go.lintTool": "golangci-lint"
}
```

### 3. Running the Backend

```bash
# Development mode (auto-reload not built-in)
go run .

# With debug output
DEBUG=1 go run .

# On custom port
PORT=8766 go run .
```

You should see:
```
Server running on http://localhost:8765
Watching for session updates...
```

### 4. Backend Architecture

Key packages:
- `internal/adapters/` — Parser interface + implementations (Claude Code, Copilot)
- `internal/store/` — In-memory session database + aggregation
- `internal/api/` — HTTP handlers
- `internal/models/` — DTOs and domain models
- `internal/ws/` — WebSocket hub
- `internal/watcher/` — Filesystem watcher

See [System Design Overview](Dev-System-Design-Overview) for detailed flow.

## Frontend (React)

### 1. Prepare Dependencies
```bash
cd web
npm install
```

### 2. Code Editor Setup (VS Code)

Install extensions:
- **ES7+ React/Redux/React-Native** (dsznajder.es7-react-js-snippets)
- **Vite** (antfu.vite)
- **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss)

### 3. Running the Dev Server

```bash
cd web
npm run dev
```

You should see:
```
VITE v4.x.x  ready in 234 ms

➜  Local:   http://localhost:5173/
```

### 4. Environment Variables

Create `web/.env.local`:
```
VITE_API_URL=http://localhost:8765
VITE_WS_URL=ws://localhost:8765
```

These are defaults, but you can override for custom setups.

### 5. Frontend Architecture

Key directories:
- `web/src/pages/` — Route pages (Dashboard, Sessions, Settings)
- `web/src/components/` — Reusable UI components
- `web/src/hooks/` — Custom hooks (useWebSocket, useStats, etc.)
- `web/src/api.js` — API client wrapper

Uses:
- **React 18** with hooks
- **React Router v6** for navigation
- **Tailwind CSS** for styling
- **Chart.js** for charts
- **Fetch API** for HTTP

See [Component Breakdown](Dev-Component-Breakdown) for details on each component.

## Full Stack Development Workflow

### Terminal Setup

**Option 1: Two terminals side by side**
```bash
# Terminal 1: Frontend
cd web && npm run dev

# Terminal 2: Backend
go run .
```

**Option 2: tmux / screen (advanced)**
```bash
# Create session with two panes
tmux new-session -d -s dashboard -x 240 -y 60
tmux send-keys -t dashboard "cd web && npm run dev" Enter
tmux split-window -t dashboard
tmux send-keys -t dashboard "go run ." Enter

# Attach to session
tmux attach -t dashboard
```

### Development Workflow

1. **Make a backend change**
   - Edit `.go` file
   - Stop and restart `go run .`
   - Reload browser

2. **Make a frontend change**
   - Edit `.jsx` file
   - Browser hot-reloads automatically
   - Check Network tab for API calls

3. **Add a dependency**
   - Go: `go get package/name`
   - React: `npm install package`

4. **Check types (frontend)**
   - No TypeScript yet, but use JSDoc:
   ```jsx
   /**
    * @param {string} sessionId
    * @returns {Promise<Session>}
    */
   async function fetchSession(sessionId) { ... }
   ```

## Testing Locally

### Backend Tests
```bash
go test ./...
make test
```

See [Testing Requirements](Dev-Testing-Requirements) for test patterns.

### Frontend Tests (future)
```bash
cd web
npm test
```

## API Debugging

### Check backend endpoints
```bash
# Health check
curl http://localhost:8765/api/health

# Get stats
curl http://localhost:8765/api/stats?days=7

# Get sessions
curl http://localhost:8765/api/sessions?page=1&limit=10
```

### WebSocket debugging
In browser console:
```javascript
// Already connected if you see the live update banner
// Test message from DevTools
ws = new WebSocket('ws://localhost:8765/ws');
ws.onmessage = (e) => console.log('WS:', e.data);
ws.send('test');
```

## Database Simulation

The dashboard uses in-memory storage. To test with local Claude sessions:

1. Make sure you have Claude Code sessions:
   ```bash
   ls ~/.claude/projects/
   ```

2. Dashboard will auto-load them on startup

3. To simulate a new session, create a `.jsonl` file:
   ```bash
   # This is a simplified example — actual format is in adapters/claudecode/adapter.go
   echo '{"turn": 1, "input_tokens": 100}' > ~/.claude/projects/test/session-1.jsonl
   ```

4. Watcher will detect the change and reload

## IDE Configuration

### VS Code workspace (recommended)
Create `.vscode/settings.json`:
```json
{
  "[go]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "golang.go"
  },
  "[javascript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "go.useLanguageServer": true,
  "go.lintOnSave": "package"
}
```

### Debugging (Go)

In VS Code, add `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Go",
      "type": "go",
      "request": "launch",
      "mode": "debug",
      "program": "${fileDirname}",
      "env": {},
      "args": []
    }
  ]
}
```

Then set breakpoints and press F5.

## Performance Tips

### Backend
- Use `go build -o ai-sessions . && ./ai-sessions` for production-like testing
- Profile with `pprof` for memory leaks:
  ```bash
  go tool pprof http://localhost:8765/debug/pprof/heap
  ```

### Frontend
- Check DevTools → Network tab to see API payload sizes
- Use React DevTools to find unnecessary re-renders
- Check Lighthouse score (`npm run build` first)

## Deployment Testing

### Production build locally
```bash
make build
./ai-sessions
# Visit http://localhost:8765
```

This builds the React app and embeds it in the Go binary, simulating production.

See [Building & Deployment](Dev-Building-Deployment) for release steps.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 8765 already in use | `PORT=8766 go run .` |
| Port 5173 already in use | `cd web && npm run dev -- --port 5174` |
| `go: command not found` | Install Go or add to PATH |
| `npm: command not found` | Install Node.js or add to PATH |
| Stale module cache | `go clean -modcache && go mod download` |
| Node cache issues | `cd web && rm -rf node_modules package-lock.json && npm install` |
| Hot reload not working | Restart `go run .` and refresh browser |
| API returns 404 | Check backend server is running on 8765 |

## Next Steps

- **Quick start:** [Getting Started Quick Start](Dev-Getting-Started-Quick-Start)
- **Architecture dive:** [System Design Overview](Dev-System-Design-Overview)
- **Contributing:** [PR Process](Dev-PR-Process)
