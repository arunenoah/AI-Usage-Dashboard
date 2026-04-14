# Developer Quick Start (15 minutes)

Get the AI Usage Dashboard running locally with both frontend and backend.

## Prerequisites

You need:
- **Go 1.18 or later** — [go.dev](https://go.dev/dl)
- **Node.js 16+ with npm** — [nodejs.org](https://nodejs.org)
- **Git**
- A copy of the repository

## Step 1: Clone and Explore

```bash
git clone https://github.com/arunenoah/AI-Usage-Dashboard.git
cd AI-Usage-Dashboard
```

Explore the structure:
```
.
├── main.go                  # Entry point
├── internal/
│   ├── adapters/            # Session parsers
│   ├── api/                 # REST handlers
│   ├── models/              # Data structures
│   ├── store/               # In-memory store
│   ├── watcher/             # File watcher
│   └── ws/                  # WebSocket hub
├── web/                     # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   └── components/
│   └── package.json
└── Makefile
```

## Step 2: Install Dependencies

### Backend
```bash
go mod download
```

### Frontend
```bash
cd web
npm install
cd ..
```

## Step 3: Run Both Servers

### Terminal 1: Frontend dev server
```bash
cd web
npm run dev
```

You'll see:
```
VITE v4.x.x  ready in 234 ms

➜  Local:   http://localhost:5173/
```

### Terminal 2: Backend server
```bash
go run .
```

You'll see:
```
Server running on http://localhost:8765
Watching for session updates...
```

## Step 4: View the Dashboard

Open **http://localhost:5173** (Vite dev proxy)

The frontend proxies:
- `/api` → `http://localhost:8765`
- `/ws` → `ws://localhost:8765`

You should see:
- KPI cards (Sessions, Tokens, Projects)
- Token trend chart
- Session explorer table
- Prompt scoring insights

## Step 5: Make Your First Change

### Backend Change
Edit `internal/api/handlers.go`:
```go
// Find HealthHandler
func HealthHandler(w http.ResponseWriter, r *http.Request) {
    // Add a custom header
    w.Header().Set("X-Developer", "working")
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
```

Restart the backend server and check:
```bash
curl http://localhost:8765/api/health
```

### Frontend Change
Edit `web/src/pages/Dashboard.jsx`:
- Change a chart title
- Modify a button label
- Save and watch hot reload

Changes appear instantly at http://localhost:5173

## Next Steps

- **Setup details:** [Local Development Setup](Dev-Local-Development-Setup)
- **Understand architecture:** [System Design Overview](Dev-System-Design-Overview)
- **Code guidelines:** [Code Style](Dev-Code-Style)
- **Run tests:** [Testing Requirements](Dev-Testing-Requirements)

## Troubleshooting

**Port already in use?**
```bash
# Change backend port
PORT=8766 go run .

# Change frontend port
cd web && npm run dev -- --port 5174
```

**Go module errors?**
```bash
go mod tidy
go mod download
```

**Node dependencies issue?**
```bash
cd web
rm -rf node_modules package-lock.json
npm install
```

## Common Commands

```bash
# Build production binary
make build

# Run all tests
make test

# Format code
go fmt ./...
```

See [Building & Deployment](Dev-Building-Deployment) for release instructions.
