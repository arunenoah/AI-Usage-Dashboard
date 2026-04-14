# Testing Requirements

What to test and how, for both backend and frontend.

## Backend Testing (Go)

### Unit Tests

**Purpose:** Test individual functions in isolation.

**Location:** `*_test.go` files next to source code

```
internal/
├── adapters/
│   ├── adapter.go
│   └── adapter_test.go       # Tests for adapter.go
├── store/
│   ├── store.go
│   └── store_test.go
└── api/
    ├── handlers.go
    └── handlers_test.go
```

### Test File Template

```go
// internal/store/store_test.go

package store

import (
    "testing"
    "time"
    
    "ai-sessions/internal/models"
)

// Test naming: TestFunction or TestFunction_Scenario
func TestStoreUpsert(t *testing.T) {
    // Arrange
    store := NewStore()
    session := &models.Session{
        ID: "test-1",
        InputTokens: 100,
        OutputTokens: 50,
    }
    
    // Act
    store.Upsert(session)
    
    // Assert
    retrieved := store.GetSession("test-1")
    if retrieved == nil {
        t.Fatal("session not found after upsert")
    }
    if retrieved.InputTokens != 100 {
        t.Errorf("expected 100 input tokens, got %d", retrieved.InputTokens)
    }
}

// Test error case
func TestStoreUpsert_NilSession(t *testing.T) {
    store := NewStore()
    
    // Should handle nil gracefully
    store.Upsert(nil)
    
    sessions := store.GetSessions()
    if len(sessions) != 0 {
        t.Error("expected no sessions after nil upsert")
    }
}

// Test with table-driven approach
func TestParseSessionFile(t *testing.T) {
    tests := []struct {
        name string
        jsonl string
        wantSessions int
        wantErr bool
    }{
        {
            name: "valid single turn",
            jsonl: `{"role": "user", "tokens": 100}
{"role": "assistant", "tokens": 200}`,
            wantSessions: 1,
            wantErr: false,
        },
        {
            name: "invalid JSON",
            jsonl: `{invalid json}`,
            wantSessions: 0,
            wantErr: true,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            sessions, err := parseJSONL(tt.jsonl)
            
            if (err != nil) != tt.wantErr {
                t.Errorf("parseJSONL() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            
            if len(sessions) != tt.wantSessions {
                t.Errorf("got %d sessions, want %d", len(sessions), tt.wantSessions)
            }
        })
    }
}
```

### Running Tests

```bash
# Run all tests
go test ./...

# Run specific test
go test ./internal/store -run TestStoreUpsert

# Verbose output
go test -v ./...

# With coverage
go test -cover ./...

# Generate coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

### Testing Best Practices

**Use sub-tests for organization:**
```go
func TestAdapter(t *testing.T) {
    t.Run("Load", func(t *testing.T) {
        // Test Load()
    })
    
    t.Run("Watch", func(t *testing.T) {
        // Test Watch()
    })
}
```

**Mock dependencies:**
```go
// Good: Inject mock store
type mockStore struct {
    sessions map[string]*Session
}

func (m *mockStore) GetSessions() []Session {
    // Return mock data
}

func TestAPIHandler(t *testing.T) {
    mockStore := &mockStore{
        sessions: map[string]*Session{
            "1": {ID: "1", InputTokens: 100},
        },
    }
    
    handler := SessionsHandler(mockStore)
    // Test with mock
}
```

**Use fixtures for test data:**
```go
func TestSession() *models.Session {
    return &models.Session{
        ID: "test-1",
        ProjectPath: "/tmp/test",
        InputTokens: 100,
        OutputTokens: 50,
    }
}

func TestStoreUpsert(t *testing.T) {
    store := NewStore()
    store.Upsert(TestSession())
    
    // Assert...
}
```

### Coverage Goals

Minimum coverage by component:

| Component | Coverage | Why |
|-----------|----------|-----|
| Adapter | 80%+ | Core parsing logic |
| Store | 85%+ | Thread safety, aggregation |
| API | 70%+ | HTTP handlers (easier to test manually) |
| Models | 50%+ | Data structures (less logic) |

Check coverage:
```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## Frontend Testing (React)

### Unit Tests

**Location:** `*.test.jsx` files next to components

```
web/src/
├── components/
│   ├── KPICard.jsx
│   └── KPICard.test.jsx
├── hooks/
│   ├── useWebSocket.js
│   └── useWebSocket.test.js
└── pages/
    ├── Dashboard.jsx
    └── Dashboard.test.jsx
```

### Test Library Setup

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jest
```

### React Component Test Template

```jsx
// web/src/components/KPICard.test.jsx

import { render, screen } from '@testing-library/react';
import KPICard from './KPICard';

describe('KPICard', () => {
    test('renders label and value', () => {
        render(
            <KPICard
                label="Sessions"
                value={42}
                unit="sessions"
            />
        );
        
        expect(screen.getByText('Sessions')).toBeInTheDocument();
        expect(screen.getByText('42 sessions')).toBeInTheDocument();
    });
    
    test('displays trend if provided', () => {
        render(
            <KPICard
                label="Growth"
                value={15}
                trend="+5%"
            />
        );
        
        expect(screen.getByText('+5%')).toBeInTheDocument();
    });
    
    test('renders icon if provided', () => {
        render(
            <KPICard
                label="Sessions"
                value={42}
                icon={<span data-testid="icon">Icon</span>}
            />
        );
        
        expect(screen.getByTestId('icon')).toBeInTheDocument();
    });
});
```

### Hook Testing

```jsx
// web/src/hooks/useWebSocket.test.js

import { renderHook, waitFor } from '@testing-library/react';
import useWebSocket from './useWebSocket';

describe('useWebSocket', () => {
    test('connects to WebSocket URL', async () => {
        const { result } = renderHook(() => useWebSocket('ws://localhost:8765/ws'));
        
        await waitFor(() => {
            expect(result.current.connected).toBe(true);
        });
    });
    
    test('handles incoming message', async () => {
        const { result } = renderHook(() => useWebSocket('ws://localhost:8765/ws'));
        
        // Simulate message from server
        // (requires WebSocket mock or test server)
        
        await waitFor(() => {
            expect(result.current.lastEvent).toEqual({
                type: 'session_updated',
                session_id: '123',
            });
        });
    });
});
```

### Page/Integration Tests

```jsx
// web/src/pages/Dashboard.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';

// Mock API calls
jest.mock('../api', () => ({
    api: {
        getStats: jest.fn(() => Promise.resolve({
            total_sessions: 42,
            total_tokens: 150000,
            daily_metrics: [],
        })),
        getInsights: jest.fn(() => Promise.resolve({
            tier: "Intermediate",
            score: 6,
        })),
    }
}));

describe('Dashboard', () => {
    test('displays KPI cards', async () => {
        render(<Dashboard />);
        
        await waitFor(() => {
            expect(screen.getByText('Sessions')).toBeInTheDocument();
            expect(screen.getByText('42')).toBeInTheDocument();
        });
    });
    
    test('loads stats on mount', async () => {
        const api = require('../api').api;
        
        render(<Dashboard />);
        
        await waitFor(() => {
            expect(api.getStats).toHaveBeenCalledWith(7);
        });
    });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# With coverage
npm test -- --coverage

# Single test file
npm test KPICard.test.jsx
```

### Testing Best Practices

**Mock external dependencies:**
```jsx
jest.mock('../api', () => ({
    api: {
        getStats: jest.fn(),
    }
}));
```

**Use data-testid for hard-to-select elements:**
```jsx
// Component
<div data-testid="total-tokens">{totalTokens}</div>

// Test
const element = screen.getByTestId('total-tokens');
```

**Wait for async operations:**
```jsx
await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

**Test user interactions:**
```jsx
import userEvent from '@testing-library/user-event';

test('filters sessions on input', async () => {
    render(<SessionExplorer />);
    
    const input = screen.getByPlaceholderText('Search...');
    await userEvent.type(input, 'webapp');
    
    expect(screen.getByText('webapp session')).toBeInTheDocument();
});
```

## Integration Testing

### Scenario: End-to-End Session Flow

```bash
# Setup
# 1. Start backend: go run .
# 2. Create mock session: ~/.claude/projects/test/session-1.jsonl
# 3. Visit http://localhost:5173

# Verify
# 1. Dashboard loads
# 2. Session appears in explorer
# 3. Click session → detail drawer opens
# 4. Close drawer → back to explorer
```

### API Integration Test

```bash
# Test API endpoints manually
curl -s http://localhost:8765/api/stats?days=7 | jq '.'
curl -s http://localhost:8765/api/sessions | jq '.[0]'
curl -s http://localhost:8765/api/conversations | jq '.'
```

## Performance Testing

### Backend

```bash
# Load test with hey
go install github.com/rakyll/hey@latest

hey -n 1000 -c 10 http://localhost:8765/api/stats?days=7

# Profiling
go test -cpuprofile=cpu.prof -memprofile=mem.prof ./...
go tool pprof cpu.prof
```

### Frontend

```bash
# Lighthouse (Chrome)
npm run build
lighthouse http://localhost:8765

# DevTools performance tab
# 1. Open DevTools
# 2. Performance tab
# 3. Record interaction
# 4. Analyze flame graph
```

## Continuous Integration

### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.18'
      - run: go test -cover ./...
      - run: go vet ./...

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      - run: cd web && npm install && npm test
```

## Test Coverage Goals

| Scope | Target | Rationale |
|-------|--------|-----------|
| Core logic (adapters, store) | 80%+ | Critical for data integrity |
| API handlers | 70%+ | Easier to test manually |
| React components | 60%+ | UI changes are common |
| Overall | 70%+ | Reasonable balance |

## Checklist Before Committing

- [ ] New functions have tests
- [ ] Tests pass: `go test ./...` and `npm test`
- [ ] Coverage hasn't decreased
- [ ] No console errors or warnings
- [ ] Error cases are tested
- [ ] Edge cases are considered

## Next Steps

- **Code style:** [Code Style & Standards](Dev-Code-Style)
- **Contributing:** [PR Process](Dev-PR-Process)
- **Building:** [Building & Deployment](Dev-Building-Deployment)
