# Code Style & Standards

Go and React conventions for the AI Usage Dashboard.

## Go Code Style

### Naming Conventions

**Packages:**
- Lowercase, no underscores
- Descriptive, short
```go
// Good
package store
package adapters

// Bad
package my_store
package Store
```

**Interfaces:**
- Verb + "-er" suffix for single-method interfaces
```go
// Good
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Adapter interface {
    Load(dirPath string) ([]Session, error)
}

// Bad
type ReadWriter interface {
    // ...
}
```

**Functions/Methods:**
- Camel case (no underscores)
- Exported: Capitalized (exported), lowercase (unexported)
```go
// Good
func NewStore() *Store { ... }       // Constructor
func (s *Store) Upsert(sess *Session) { ... }
func (s *Store) getStats() Stats { }  // Private helper

// Bad
func new_store() { }
func (s *Store) UPSERT() { }
func get_stats() { }
```

**Constants:**
- All caps, underscores for multi-word
```go
// Good
const DefaultPort = 8765
const MAX_SESSIONS = 10000

// Bad
const default_port = 8765
const maxSessions = 10000
```

**Variables:**
- Short scope = short names
- Long scope = descriptive names
```go
// Good
for i := 0; i < len(sessions); i++ { ... }  // Loop counter
sessionID := extractID(session)               // Full scope
var totalInputTokens int                      // At package level

// Bad
for sessionIndex := 0; sessionIndex < len(sessions); sessionIndex++ { }
i := extractID(session)
var t int
```

### File Organization

Structure files logically:

```go
package store

import (
    "fmt"
    "log"
    "sync"
    
    "ai-sessions/internal/models"
)

// Types
type Store struct { ... }
type storeOption struct { ... }

// Public methods
func (s *Store) Load() { ... }
func (s *Store) Upsert() { ... }

// Private helpers
func (s *Store) aggregate() { ... }
func validate(data interface{}) error { ... }
```

### Comments

**Package-level:** Explain purpose
```go
// Package store provides in-memory session storage with aggregation.
package store
```

**Function-level:** Explain what it does (not how)
```go
// Good
// Load reads all session files from dirPath and stores them.
func (s *Store) Load(dirPath string) error { ... }

// Bad
// This function loads the sessions
func (s *Store) Load(dirPath string) error { ... }

// Horrible
// Load
func (s *Store) Load(dirPath string) error { ... }
```

**Inline:** Explain why, not what
```go
// Good
// Use RWMutex to allow concurrent reads
s.mu.RLock()
data := s.sessions[id]
s.mu.RUnlock()

// Bad
// Lock the mutex
s.mu.RLock()
// Get data
data := s.sessions[id]
// Unlock the mutex
s.mu.RUnlock()
```

### Error Handling

**Always check errors:**
```go
// Good
file, err := os.Open(path)
if err != nil {
    return fmt.Errorf("open %s: %w", path, err)
}
defer file.Close()

// Bad
file, _ := os.Open(path)
defer file.Close()

// Also bad
file, err := os.Open(path)
// using file without checking
```

**Wrap errors with context:**
```go
// Good
data, err := adapter.Load(path)
if err != nil {
    return nil, fmt.Errorf("load sessions: %w", err)
}

// Bad
return nil, err
```

**Custom error types for important cases:**
```go
type ValidationError struct {
    Field string
    Issue string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Issue)
}

// Usage
if session.ID == "" {
    return &ValidationError{Field: "ID", Issue: "required"}
}
```

### Concurrency

**Use sync patterns:**
```go
// Good: Thread-safe read-write
type Store struct {
    mu sync.RWMutex
    data map[string]*Session
}

func (s *Store) Get(id string) *Session {
    s.mu.RLock()
    defer s.mu.RUnlock()
    return s.data[id]
}

// Bad: Race condition
func (s *Store) Get(id string) *Session {
    return s.data[id]  // Not locked!
}
```

**Channels for signaling:**
```go
// Good
done := make(chan struct{})
go func() {
    // work...
    close(done)
}()
<-done

// Bad
var finished bool
go func() {
    // work...
    finished = true  // Race condition
}()
for !finished { }  // Busy wait
```

## React Code Style

### Component Structure

**Functional components with hooks:**
```jsx
// Good
function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        // Load stats
    }, []);
    
    if (loading) return <div>Loading...</div>;
    
    return (
        <div className="dashboard">
            {/* JSX */}
        </div>
    );
}

// Bad: Class component (legacy)
class Dashboard extends React.Component {
    // ...
}
```

### Naming Conventions

**Components:** PascalCase
```jsx
// Good
function UserProfile() { ... }
function SessionExplorer() { ... }

// Bad
function userProfile() { ... }
function user_profile() { ... }
```

**Hooks:** camelCase, start with "use"
```jsx
// Good
function useWebSocket(url) { ... }
function useStats() { ... }

// Bad
function webSocket(url) { ... }
function use_web_socket(url) { ... }
```

**Variables:** camelCase
```jsx
// Good
const sessionList = [...];
const [selectedSession, setSelectedSession] = useState(null);

// Bad
const session_list = [...];
const SESSION_LIST = [...];
```

### File Organization

```
web/src/
├── pages/
│   ├── Dashboard.jsx     # Page component
│   ├── Sessions.jsx
│   └── Settings.jsx
├── components/
│   ├── KPICard.jsx       # Reusable component
│   ├── TokenChart.jsx
│   └── SessionTable.jsx
├── hooks/
│   ├── useWebSocket.js   # Custom hook
│   ├── useStats.js
│   └── useLocalStorage.js
├── api.js                # API client
└── App.jsx               # Root component
```

### Props and State

**Use descriptive prop names:**
```jsx
// Good
<KPICard
    label="Sessions"
    value={42}
    unit="sessions"
    trend="+5%"
/>

// Bad
<KPICard
    l="Sessions"
    v={42}
    u="sessions"
    t="+5%"
/>
```

**Validate props with JSDoc:**
```jsx
/**
 * Display a metric card.
 * @param {string} label - Card title
 * @param {number} value - Primary metric value
 * @param {string} unit - Label suffix
 * @param {string} trend - Percentage change
 * @returns {JSX.Element}
 */
function KPICard({ label, value, unit, trend }) {
    // ...
}
```

**State naming: [value, setValue]:**
```jsx
// Good
const [stats, setStats] = useState(null);
const [filters, setFilters] = useState({ scoreMin: 1 });
const [isLoading, setIsLoading] = useState(false);

// Bad
const [stats, updateStats] = useState(null);
const [stat, setStat] = useState(null);  // Singular, confusing with array
const [load, setLoad] = useState(false);  // Ambiguous
```

### Hooks Best Practices

**useEffect dependencies:**
```jsx
// Good: Fetch on mount
useEffect(() => {
    fetchStats();
}, []);

// Good: Refetch when date range changes
useEffect(() => {
    fetchStats(dateRange);
}, [dateRange]);

// Bad: No dependencies (runs every render)
useEffect(() => {
    fetchStats();
});

// Bad: Missing dependency (stale closure)
useEffect(() => {
    fetchStats(dateRange);
}, []);  // Should include dateRange
```

**Custom hooks as extraction:**
```jsx
// Good: Extract hook from component logic
function useWebSocket(url) {
    const [connected, setConnected] = useState(false);
    
    useEffect(() => {
        const ws = new WebSocket(url);
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        return () => ws.close();
    }, [url]);
    
    return { connected };
}

// Usage
function App() {
    const { connected } = useWebSocket('ws://localhost:8765/ws');
    return <div>{connected ? 'Connected' : 'Disconnected'}</div>;
}
```

### JSX Style

**Props formatting:**
```jsx
// Good: Single line if simple
<Button label="Click me" onClick={onClick} />

// Good: Multi-line if complex
<KPICard
    label="Tokens Used"
    value={totalTokens}
    unit="tokens"
    trend="+15%"
    icon={<TokenIcon />}
/>

// Bad: Inconsistent
<Button label="Click me" 
onClick={onClick} 
disabled={false}
/>
```

**Conditional rendering:**
```jsx
// Good: Ternary for simple cases
{isLoading ? <Spinner /> : <Dashboard data={stats} />}

// Good: Logical AND for single branch
{hasError && <ErrorBanner message={error} />}

// Good: Extract complex logic to function
{renderContent()}

// Bad: Inline if statements
{if (isLoading) { return <Spinner />; }}

// Bad: Unnecessary ternary
{isLoading === true ? <Spinner /> : null}
```

### API Calls

**Centralized API client:**
```jsx
// Good: api.js
export const api = {
    getStats(days) {
        return fetch(`/api/stats?days=${days}`).then(r => r.json());
    },
    getSessions(page, limit) {
        return fetch(`/api/sessions?page=${page}&limit=${limit}`).then(r => r.json());
    }
};

// Usage in component
useEffect(() => {
    api.getStats(7).then(stats => setStats(stats));
}, []);

// Bad: Fetch inline
useEffect(() => {
    fetch('/api/stats?days=7')
        .then(r => r.json())
        .then(s => setStats(s));
}, []);
```

**Error handling:**
```jsx
// Good
useEffect(() => {
    setLoading(true);
    api.getStats(days)
        .then(stats => setStats(stats))
        .catch(err => {
            console.error('Failed to load stats:', err);
            setError('Failed to load stats. Please try again.');
        })
        .finally(() => setLoading(false));
}, [days]);

// Bad: Ignored error
useEffect(() => {
    api.getStats(days)
        .then(stats => setStats(stats));
}, [days]);
```

## Shared Conventions

### Comments & Documentation

**Go:**
```go
// Exported functions always have a comment
// Load reads session files from dirPath.
func (s *Store) Load(dirPath string) error {
```

**JavaScript:**
```jsx
/**
 * Fetch stats for a date range.
 * @param {number} days - Days back from today
 * @returns {Promise<Stats>}
 */
async function getStats(days) {
    // Implementation
}
```

### Testing

**Go tests:**
```bash
# Run all tests
go test ./...

# With coverage
go test -cover ./...

# Verbose
go test -v ./...
```

**React tests (future):**
```bash
# Run Jest
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Code Review Checklist

Before submitting code:

- [ ] **Naming:** Are names clear and consistent?
- [ ] **Comments:** Are non-obvious sections documented?
- [ ] **Errors:** Are all errors handled/checked?
- [ ] **Tests:** Are new functions tested?
- [ ] **Format:** Run `go fmt` and `prettier`?
- [ ] **Duplication:** Is there repeated code to extract?
- [ ] **Performance:** Any obvious inefficiencies?
- [ ] **Security:** Any unvalidated input, hardcoded secrets?

## Formatting Tools

### Go

**Auto-format:**
```bash
go fmt ./...
```

**Lint:**
```bash
golangci-lint run ./...
```

**Configuration:**
```yaml
# .golangci.yml
linters:
  enable:
    - errcheck
    - govet
    - staticcheck
```

### JavaScript

**Format with Prettier:**
```bash
npx prettier --write web/src/
```

**Lint with ESLint:**
```bash
npx eslint web/src/
```

**Configuration:**
```json
// web/.eslintrc.json
{
  "extends": "eslint:recommended",
  "rules": {
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": "warn"
  }
}
```

## Next Steps

- **Testing:** [Testing Requirements](Dev-Testing-Requirements)
- **Contributing:** [PR Process](Dev-PR-Process)
- **Architecture:** [System Design Overview](Dev-System-Design-Overview)
