---
title: AI-Usage-Dashboard Wiki Design
date: 2026-04-14
status: Approved
audience: End users, developers, contributors
---

# AI-Usage-Dashboard Wiki Design Specification

## Overview

Create a **role-based GitHub wiki** for the AI-Usage-Dashboard repository that serves both **end users** (who run the dashboard locally) and **developers** (who extend/contribute to it). The wiki uses progressive disclosure: a unified home page with role-based navigation paths, shared reference content, and deep guides without duplicating the README.

## Design Goals

1. **Lower barrier to entry** for beginners by explaining concepts in plain language (CARE scoring, tokens, adapters)
2. **Unblock contributors** with clear architecture docs, adapter development guide, and contribution workflow
3. **Avoid duplication** — README remains authoritative for API reference and quick tour; wiki goes deeper
4. **Discoverable** — users find exactly what they need based on their role without wading through technical jargon

## Home Page & Navigation

### Home Page Layout

**Hero Section:**
- Title: "AI Usage Dashboard — Understand your Claude Code sessions"
- Subtitle: One-paragraph description of what the dashboard does
- Feature highlights (3-4 bullets)

**Role Selection (Prominent CTAs):**
- 🟢 **I'm a User** — Analytics, prompts, features, troubleshooting
- 🔵 **I'm a Developer** — Architecture, contribution, extending

**Quick Access (available to both):**
- "5-Minute Quick Start" link
- "Glossary" link
- Link to README (for API reference)

**Footer:**
- GitHub Issues link
- Contributing guide link

### Sidebar Navigation (Role-Dependent)

#### User Mode Sidebar:
```
Getting Started
  ├── Quick Start (5 min)
  ├── Installation
  └── First Run & Data Discovery

Features & Guides
  ├── Dashboard Overview
  ├── CARE Scoring Explained
  ├── Prompt Examples & Improvement
  ├── Token Metrics & Cache Efficiency
  └── Interpreting Insights

Troubleshooting & FAQs

Tips & Best Practices
```

#### Developer Mode Sidebar:
```
Getting Started
  ├── Quick Start (5 min)
  └── Local Development Setup

Architecture
  ├── System Design Overview
  ├── Component Breakdown
  └── Data Flow & State Management

Extending the Dashboard
  ├── Adapter Development Guide
  ├── Adding New Metrics
  └── API Extensions

Contributing
  ├── Code Style & Standards
  ├── Testing Requirements
  ├── PR Process
  └── Building & Deployment
```

### Navigation Behavior

- Users can toggle roles anytime from any page
- Sidebar updates to reflect active role
- Deep links work regardless of role context
- Role preference persists in browser localStorage

---

## User Path Content (End Users)

### Getting Started Section

#### Quick Start (5 min)
- Download latest release or clone repo
- Install: `brew install go node` (or equivalent for Linux/Windows)
- Run: `make build && ./ai-sessions`
- Screenshot: "Dashboard loads at localhost:8765"
- "Sessions appear automatically if Claude Code is installed"
- Link to Installation page for troubleshooting

#### Installation
- Step-by-step instructions for macOS, Linux, Windows
- Prerequisites (Go 1.18+, Node.js 16+)
- Common installation issues and fixes:
  - "Go not found" → PATH setup
  - "npm install fails" → Node version mismatch
  - "Make command not found" → macOS Xcode CLI tools
- Verification: "How to know it's working"

#### First Run & Data Discovery
- Where does it look for Claude sessions? (`~/.claude/projects/`)
- Why might sessions not appear?
  - Claude Code not run yet
  - Sessions file permissions
  - Wrong Claude version
- How to verify data is loading
- Adapter selection (which sources are available?)

### Features & Guides Section

#### Dashboard Overview
- Widget-by-widget tour (KPI cards, charts, tables)
- Plain-language explanations: "What is this? Why does it matter?"
- Screenshots with annotations
- Links to detailed guides for each feature

#### CARE Scoring Explained ⭐ (Critical for Beginners)
- **What is it?** Plain English intro, not just definitions
- **The Framework:**
  - **[C] Context** (0-2 pts): File paths, function names, role/persona setup
  - **[A] Ask** (0-3 pts): Clear action verb, detailed instruction, multi-step structure
  - **[R] Rules** (0-2 pts): Constraints, boundaries, expected behavior
  - **[E] Examples** (0-2 pts): Desired output format, code examples, before/after
- **Score Meanings (in plain English):**
  - 1-4 Weak: Missing most dimensions, vague instructions
  - 5-6 Needs Work: Has some structure but missing critical details
  - 7-8 Decent: Mostly well-structured, minor gaps
  - 9-10 Good: Comprehensive, actionable, well-scoped
- **Real Examples:**
  - Bad prompt (score 2) with annotation of missing CARE elements
  - Better version (score 7) showing incremental fixes
  - Best version (score 9) showing completeness
- **How It's Calculated:** Server-side logic, not user input
- **Why scores are strict:** Designed to challenge you to improve

#### Prompt Examples & Improvement
- How to use the "examples →" link in Prompt Insights
- What the panel shows: bad prompt (red), better version (green), explanation
- Real examples drawn from your session data
- How to apply lessons to your own prompts

#### Token Metrics & Cache Efficiency
- **What are tokens?** Input tokens (your prompt) + output tokens (Claude's response)
- **Why does it matter?** Token consumption = usage, context limits, quality
- **Cache efficiency:** What is prompt caching? How does it work?
- **How to optimize:**
  - Reuse complex contexts
  - Leverage cache hits for related tasks
  - Monitor cache hit rate in dashboard
- **Reading the charts:** Input vs output breakdown, area chart interpretation

#### Interpreting Insights
- **Tier system:** What does Beginner → Expert mean?
- **Per-dimension insights:** Output ratio, agent delegation, prompt specificity, tool breadth
- **Peer benchmarks:** How you compare to other users
- **Path to Next Tier:** What to improve and how to measure progress
- **Using real examples to learn:** Links to your actual prompts with improvement tips

### Troubleshooting & FAQs Section

**Common Problems & Solutions:**
- "Sessions not showing up"
  - Flowchart: Check Claude Code installation → Check file permissions → Check data directory
  - Specific fixes for each branch
- "Dashboard is slow / not responding"
  - Causes: Too many sessions, WebSocket disconnect, resource limits
  - Fixes: Clear old sessions, restart dashboard, check network
- "WebSocket connection drops frequently"
  - Debugging steps: Check network, check browser console logs
  - How to report (with logs)
- "CARE scores seem wrong / unfair"
  - How scoring is calculated with examples
  - Edge cases and why strict scoring is intentional
- "Can I share this with my team?"
  - Current single-user design explanation
  - Workarounds (shared machine, shared browser)
  - Multi-user feature status

### Tips & Best Practices Section

- **Writing better prompts using CARE:** Checklist before sending
- **Session hygiene:** Naming conventions, project organization
- **Using adapters effectively:** What each adapter (Claude Code, Copilot, Windsurf) provides
- **Reading token usage:** How to spot inefficient prompts
- **Learning from prompt examples:** Reviewing and applying lessons

---

## Developer Path Content (Contributors & Maintainers)

### Getting Started Section

#### Quick Start (5 min)
- `git clone <repo> && cd ai-sessions`
- `make build` (builds frontend + Go binary)
- `./ai-sessions` (runs on localhost:8765)
- Link to README for full details

#### Local Development Setup
- Frontend dev server: `cd web && npm install && npm run dev`
- Backend server: `go run .` (separate terminal)
- Vite proxy setup: `/api` and `/ws` forwarded to `localhost:8765`
- Hot reload workflow for frontend and backend
- Debugging tips: browser console, Go server logs

### Architecture Section

#### System Design Overview
- **Why this architecture?** Single binary, layered, embedded assets
- **Layers:**
  - **Adapter Layer:** Multi-source abstraction (Claude Code, Copilot, Windsurf, etc.)
  - **Store Layer:** In-memory indexed session store with aggregation
  - **API Layer:** REST endpoints with pagination, filtering, response shaping
  - **WebSocket Layer:** Real-time updates via hub broadcast
  - **UI Layer:** React SPA consuming REST + WebSocket
- **Trade-offs:** Single binary for simplicity, in-memory for speed (vs persistent DB)
- **Scalability considerations:** Current design is single-user; multi-user would require architectural changes

#### Component Breakdown
- **Adapter Layer (`internal/adapters/*`)**
  - Abstraction: `Adapter` interface
  - Implementations: `claudecode.Adapter`, `copilot.Adapter` (with examples for Cursor, Windsurf)
  - Responsibilities: File detection, parsing, turn extraction, metadata
  - Thread safety: Adapters are stateless
  
- **Store Layer (`internal/store/store.go`)**
  - Thread-safe in-memory session map (RWMutex-protected)
  - Aggregation logic: totals, daily summaries, cost estimation
  - Indexing: Projects, date windows, source type
  - Methods: `LoadAll()`, `Upsert()`, `GetSession()`, `GetStats()`, `GetConversations()`

- **API Layer (`internal/api/handlers.go`)**
  - REST handlers for: `/api/stats`, `/api/sessions`, `/api/conversations`, `/api/insights`, `/api/tasks`
  - Pagination: `?page=N&limit=M` pattern
  - Filtering: `?score_min=1&score_max=10`, `?project=substring`, `?period=today|week|month|all`
  - Response wrapping: Consistent JSON structure, error messages
  
- **WebSocket Layer (`internal/ws/hub.go`)**
  - Client registry (map of connections)
  - Broadcast logic: `session_updated` event type
  - Reconnect handling: Automatic re-subscribe on client reconnect
  
- **Frontend Layer (`web/src/*`)**
  - `App.jsx`: Route shell, layout
  - Pages: `Dashboard.jsx`, `Sessions.jsx`, `Settings.jsx`
  - Hooks: `useWebSocket()` for connection management
  - Components: Organized by feature (cards, charts, tables, drawers)
  - State: React hooks + local state (no Redux, considered over-engineering)

#### Data Flow & State Management
- **Update Flow:**
  1. Claude writes/updates session `.jsonl` in `~/.claude/projects/`
  2. `internal/watcher` receives fsnotify event
  3. File reparsed via adapter → `Store.Upsert(session)`
  4. WebSocket hub broadcasts `session_updated` event
  5. Frontend `useWebSocket()` hook receives update
  6. React re-renders affected components
  
- **State Locations:**
  - **Backend:** Store holds authoritative session data
  - **Frontend:** Component state (React hooks) holds UI state (selected session, filters, page)
  - **Shared:** WebSocket events trigger frontend state updates
  
- **Performance:** In-memory store is fast for <1000 sessions; beyond that, consider persistence

### Extending the Dashboard Section

#### Adapter Development Guide (with Example: Cursor)
- **What is an adapter?** A parser for a new session source
- **The Adapter Interface:**
  ```go
  type Adapter interface {
    Name() string
    SessionsDir() string
    ParseSession(filepath string) (*Session, error)
  }
  ```
- **Step-by-step: Adding Cursor support**
  1. Create `internal/adapters/cursor/adapter.go`
  2. Implement `Adapter` interface
  3. Detect Cursor session directory (e.g., `~/.cursor/sessions/`)
  4. Parse JSONL structure (similar to Claude Code)
  5. Create `Session` struct with tokens, turns, metadata
  6. Register in `main.go`: `adapters := []Adapter{claudeAdapter, cursorAdapter}`
  7. Test: Write unit tests for parser, integration test for full flow
- **File:** Example implementation with inline comments
- **UI considerations:** No UI changes needed; adapter auto-detected and listed

#### Adding New Metrics
- **Where to compute?** Decision tree:
  - **Store layer:** Aggregated across sessions (totals, daily breakdown)
  - **API layer:** Computed per request (filtering, sorting, complex aggregations)
  - **Frontend:** Client-side summaries (if computation is expensive)
- **Example: Add "most productive hour"**
  - Compute in store: aggregate session start times by hour
  - Expose via API: `GET /api/stats?include=hourly_activity`
  - Chart in frontend: Histogram or heatmap
- **Testing:** Unit test for metric logic, integration test for API, component test for chart

#### API Extensions
- **Adding an endpoint:**
  1. Define response struct in `internal/models/models.go`
  2. Write handler in `internal/api/handlers.go`
  3. Register route in `main.go`
  4. Document in README's API reference
  5. Test: Write handler test with mock store
- **Pagination best practice:** Always include `?page=N&limit=M`
- **Error handling:** Return consistent error struct with HTTP status code
- **Example:** `GET /api/conversations?period=today&limit=20&score_min=7`

### Contributing Section

#### Code Style & Standards
- **Go:**
  - Use `gofmt` and `golint`
  - Unexported functions start lowercase
  - Error handling: Always check errors, use `fmt.Errorf` with context
  - Comments: Package-level doc comment, exported function comments
  - No magic numbers — use named constants
  
- **React:**
  - Functional components + hooks only (no class components)
  - Props validation (TypeScript preferred, propTypes fallback)
  - Component naming: PascalCase
  - Hooks: `useCapitalizedName`
  - No inline styles — use Tailwind or `src/styles.css`
  
- **Git:**
  - Branch naming: `feature/adapter-windsurf`, `fix/cache-hit-calculation`, `docs/readme-update`
  - Commit messages: Imperative mood, lowercase. Example: `feat: add Cursor adapter`
  - Squash related commits before PR

#### Testing Requirements
- **Go:**
  - Unit tests for all exported functions
  - Table-driven tests for complex logic
  - File: `*_test.go` in same directory
  - Run: `go test ./...`
  - Coverage target: 70%+ for critical paths (adapters, store, API handlers)
  
- **React:**
  - Component tests with React Testing Library
  - Snapshot tests for layout components (with caution)
  - Mock API calls with `jest.mock()`
  - Test file: `Component.test.jsx`
  - Run: `npm test`
  
- **Integration Tests:**
  - End-to-end: Load session → Parse → Store → API → Frontend
  - Run: `make test` (runs both Go and React tests)

#### PR Process
- **Before you start:**
  - Check open issues/PRs to avoid duplicates
  - Discuss large features in an issue first
  
- **PR template (auto-filled):**
  ```
  ## What
  [Brief description of changes]
  
  ## Why
  [Problem solved, or feature goal]
  
  ## How
  [Technical approach, any trade-offs]
  
  ## Testing
  [How to verify]
  
  ## Checklist
  - [ ] Tests pass locally (`make test`)
  - [ ] No console errors
  - [ ] Updated README if API changed
  - [ ] Commit message follows convention
  ```
  
- **Code review checklist:**
  - Code style consistent
  - No duplicate logic
  - Tests cover main paths + edge cases
  - No hardcoded values
  - Comments explain "why", not "what"
  - Performance: Any new queries or loops explained?

#### Building & Deployment
- **Build:** `make build` creates `./ai-sessions` binary (frontend + Go combined)
- **Local test:** `PORT=8765 ./ai-sessions` (or custom port)
- **Release:**
  - Bump version in relevant files (if version tracked)
  - Tag: `git tag v0.1.0`
  - GitHub releases: Upload binary
- **Docker (optional future addition):**
  - Build image: `docker build -t ai-sessions:latest .`
  - Run: `docker run -p 8765:8765 -v ~/.claude:/root/.claude ai-sessions:latest`

---

## Shared Content & Reference

### Glossary (Available Everywhere)

- **CARE Framework:** Context, Ask, Rules, Examples. A structured way to evaluate prompt quality (1-10 scale).
- **Tokens:** Units of text processed by Claude. Input tokens (your prompt) + Output tokens (Claude's response).
- **Cache Hit Rate:** Percentage of tokens served from cache (reused context) vs newly processed.
- **Adapter:** A parser for a session source (Claude Code, Copilot, Windsurf, Cursor, etc.).
- **Session:** A single `.jsonl` file containing one user's conversation history with timing and token usage.
- **Turn:** A single user message + Claude response pair within a session.
- **WebSocket:** Real-time update mechanism. Dashboard listens for `session_updated` events.
- **Store:** In-memory session database with aggregation logic.
- **Metrics:** Aggregated statistics (tokens used, sessions count, productivity scores).
- **Tier:** Skill level classification (Beginner, Intermediate, Advanced, Expert) based on prompt quality.

### Search & Discoverability

- GitHub wiki search enabled (built-in)
- Each page tagged with searchable keywords
- Cross-links between related pages (e.g., CARE → Prompt Examples → Tips & Best Practices)
- Breadcrumbs on every page

### Relationship to README

| Document | Purpose | Content |
|----------|---------|---------|
| **README** | Quick reference + feature showcase | What it is, quick tour, API reference, architecture 101 |
| **Wiki** | Deep learning + support | Tutorials, troubleshooting, contribution guide, detailed guides |
| **API Docs** | Authoritative reference | Endpoint specs, request/response examples (stays in README) |

---

## README Restructure

### Current → New Structure

**Current README sections to restructure:**

1. **Keep as-is:**
   - Tech Stack (brief, 1-liner per tech)
   - API Reference (authoritative, stays complete)
   - WebSocket Events

2. **Simplify:**
   - Architecture Overview: Reduce from 5 paragraphs to 3 sentences + link to wiki
   - Quick Tour: Move screenshots and detailed explanations to wiki
   - Component Responsibilities: Move to wiki's "Component Breakdown"
   - Data Model Highlights: Move to wiki's Architecture
   - Local Development: Keep minimal; link to wiki for full setup

3. **Remove entirely:**
   - Troubleshooting (move to wiki)
   - Code style examples (move to wiki's Contributing guide)

4. **Add:**
   - Brief Contributing section (link to wiki)
   - Quick link to wiki home page

**Result:** README drops from ~308 lines to ~120 lines. It becomes a gateway to the wiki.

---

## Implementation Strategy

### Phase 1: Create Wiki Structure
- Create GitHub wiki with home page, sidebar, and all page stubs
- Set up role-based navigation (using wiki page organization)
- Create glossary page

### Phase 2: User Path Content
- Fill in Getting Started pages (Installation, Quick Start, First Run)
- Write Features & Guides (Dashboard Overview, CARE Scoring, Token Metrics)
- Write Troubleshooting & FAQs

### Phase 3: Developer Path Content
- Write Architecture section (System Design, Component Breakdown, Data Flow)
- Write Extending section (Adapter guide, adding metrics, API extensions)
- Write Contributing section (code style, testing, PR process)

### Phase 4: Polish & Integration
- Add cross-links and references between all pages
- Restructure README to match new wiki-first approach
- Test navigation and discoverability
- Commit design doc and wiki changes

---

## Success Criteria

- ✅ New users can get started in <5 minutes
- ✅ CARE scoring is explained in plain language (no jargon)
- ✅ Contributors can add an adapter with a step-by-step guide
- ✅ Users can troubleshoot common issues without opening GitHub issues
- ✅ Role-based navigation works smoothly
- ✅ No duplication between README and wiki
- ✅ All pages are cross-linked and discoverable

---

## Notes & Considerations

- **Wiki maintenance:** Wiki content should be reviewed and updated with each major feature release
- **Keeping in sync:** Code changes that affect API, architecture, or setup should trigger wiki updates
- **Community contributions:** Consider accepting wiki contributions via PRs in the future
- **Analytics:** Monitor which pages get the most visits to identify documentation gaps
