# Quick Start (5 Minutes)

Get the AI Usage Dashboard running in under 5 minutes.

## Prerequisites

You need:
- **Go 1.18 or later** — Download from [go.dev](https://go.dev/dl)
- **Node.js 16+ with npm** — Download from [nodejs.org](https://nodejs.org)
- **Claude Code installed** — The dashboard analyzes Claude session files at `~/.claude/projects/`

## Install & Run

### 1. Clone the repository

```bash
git clone https://github.com/arunenoah/AI-Usage-Dashboard.git
cd AI-Usage-Dashboard
```

### 2. Build the dashboard

```bash
make build
```

This builds the frontend (React + Vite) and compiles it into the Go binary.

### 3. Run the dashboard

```bash
./ai-sessions
```

You should see:
```
Server running on http://localhost:8765
Watching for session updates...
```

### 4. Open in your browser

Visit: **http://localhost:8765**

You should see the dashboard load with KPI cards, charts, and session explorer.

## First Time Setup

If you don't see your sessions:
1. Make sure you've used Claude Code and created at least one session
2. Sessions are stored in `~/.claude/projects/` automatically
3. The dashboard watches this directory for changes
4. Give it a few seconds to scan and load sessions

👉 **Not working?** See [First Run & Data Discovery](User-First-Run-Data-Discovery) for troubleshooting.

## Next Steps

- **Learn the features:** [Dashboard Overview](User-Dashboard-Overview)
- **Understand your scores:** [CARE Scoring Explained](User-CARE-Scoring-Explained)
- **Full installation guide:** [Installation](User-Installation)
- **Having issues?** [Troubleshooting](User-Troubleshooting-FAQs)

## Change the Port

By default, the dashboard runs on port 8765. To use a different port:

```bash
PORT=9000 ./ai-sessions
```

Then visit `http://localhost:9000`
