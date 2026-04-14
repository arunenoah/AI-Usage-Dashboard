# API Extensions

How to add new REST endpoints to the dashboard.

## API Architecture

The API is built on Go's `net/http` package with a simple handler pattern.

**Current structure:**
```go
// internal/api/handlers.go
func NewRouter(store *store.Store, hub *ws.Hub) http.Handler {
    mux := http.NewServeMux()
    
    // Register handlers
    mux.HandleFunc("/api/health", HealthHandler)
    mux.HandleFunc("/api/stats", StatsHandler(store))
    mux.HandleFunc("/api/sessions", SessionsHandler(store))
    // ... more handlers
    
    return mux
}
```

**Endpoints are stateless:** Each handler receives `store` and `hub` via closure.

## Adding a Simple Endpoint

### Example 1: Session Count by Model

**Goal:** `GET /api/models` returns token usage by model (Claude, Sonnet, Opus, etc.)

### Step 1: Extend Store

Edit `internal/store/store.go`:

```go
type Stats struct {
    // ... existing ...
    ModelMetrics []ModelMetric  // NEW
}

type ModelMetric struct {
    Model        string
    Sessions     int
    InputTokens  int
    OutputTokens int
}

func (s *Store) GetModelMetrics() []ModelMetric {
    s.mu.RLock()
    defer s.mu.RUnlock()
    
    models := make(map[string]*ModelMetric)
    
    for _, session := range s.sessions {
        if models[session.Model] == nil {
            models[session.Model] = &ModelMetric{Model: session.Model}
        }
        
        m := models[session.Model]
        m.Sessions++
        m.InputTokens += session.InputTokens
        m.OutputTokens += session.OutputTokens
    }
    
    // Convert map to slice
    var result []ModelMetric
    for _, m := range models {
        result = append(result, *m)
    }
    
    return result
}
```

### Step 2: Add HTTP Handler

Edit `internal/api/handlers.go`:

```go
func ModelsHandler(store *store.Store) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Only accept GET
        if r.Method != http.MethodGet {
            http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
            return
        }
        
        // Get metrics
        metrics := store.GetModelMetrics()
        
        // Sort by tokens (descending)
        sort.Slice(metrics, func(i, j int) bool {
            return metrics[i].InputTokens+metrics[i].OutputTokens >
                   metrics[j].InputTokens+metrics[j].OutputTokens
        })
        
        // Respond
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]interface{}{
            "models": metrics,
        })
    }
}
```

### Step 3: Register Route

In `NewRouter()`:

```go
func NewRouter(store *store.Store, hub *ws.Hub) http.Handler {
    mux := http.NewServeMux()
    
    // ... existing routes ...
    mux.HandleFunc("/api/models", ModelsHandler(store))
    
    return mux
}
```

### Step 4: Test

```bash
# Build and run
go run .

# Test endpoint
curl http://localhost:8765/api/models | jq '.'

# Expected response:
# {
#   "models": [
#     {"model": "haiku", "sessions": 5, "input_tokens": 1000, "output_tokens": 500},
#     {"model": "sonnet", "sessions": 3, "input_tokens": 2000, "output_tokens": 1500}
#   ]
# }
```

## Advanced: Filtering and Pagination

### Example 2: Sessions with Advanced Filtering

**Goal:** `GET /api/sessions?project=webapp&model=sonnet&min_tokens=1000&page=1`

```go
func SessionsHandler(store *store.Store) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Parse query parameters
        project := r.URL.Query().Get("project")
        model := r.URL.Query().Get("model")
        minTokens := parseInt(r.URL.Query().Get("min_tokens"), 0)
        page := parseInt(r.URL.Query().Get("page"), 1)
        limit := parseInt(r.URL.Query().Get("limit"), 20)
        
        // Validate pagination
        if page < 1 {
            page = 1
        }
        if limit < 1 || limit > 100 {
            limit = 20
        }
        offset := (page - 1) * limit
        
        // Get filtered sessions from store
        sessions := store.GetSessions()
        
        var filtered []models.Session
        for _, s := range sessions {
            // Apply filters
            if project != "" && !strings.Contains(s.ProjectPath, project) {
                continue
            }
            if model != "" && s.Model != model {
                continue
            }
            totalTokens := s.InputTokens + s.OutputTokens
            if totalTokens < minTokens {
                continue
            }
            filtered = append(filtered, s)
        }
        
        // Paginate
        total := len(filtered)
        if offset > total {
            offset = total
        }
        end := offset + limit
        if end > total {
            end = total
        }
        paged := filtered[offset:end]
        
        // Respond
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]interface{}{
            "sessions": paged,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) / limit,
        })
    }
}
```

## Streaming Responses

For large datasets, stream JSON instead of loading everything in memory:

```go
func LargeDataHandler(store *store.Store) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("Transfer-Encoding", "chunked")
        
        // Start JSON array
        fmt.Fprint(w, "{\"sessions\":[")
        
        sessions := store.GetSessions()
        
        for i, session := range sessions {
            if i > 0 {
                fmt.Fprint(w, ",")
            }
            
            // Encode one session
            json.NewEncoder(w).Encode(session)
            
            // Flush to client (for streaming effect)
            if flusher, ok := w.(http.Flusher); ok {
                flusher.Flush()
            }
        }
        
        fmt.Fprint(w, "]}")
    }
}
```

## Error Handling

Consistent error responses:

```go
type ErrorResponse struct {
    Error   string `json:"error"`
    Status  int    `json:"status"`
    Details string `json:"details,omitempty"`
}

func RespondError(w http.ResponseWriter, statusCode int, message string, details string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(ErrorResponse{
        Error: message,
        Status: statusCode,
        Details: details,
    })
}

// Usage
if project == "" {
    RespondError(w, http.StatusBadRequest, "missing required parameter", "project is required")
    return
}
```

## Request Validation

Always validate input:

```go
func getInt(r *http.Request, key string, defaultVal int) (int, error) {
    val := r.URL.Query().Get(key)
    if val == "" {
        return defaultVal, nil
    }
    
    i, err := strconv.Atoi(val)
    if err != nil {
        return 0, fmt.Errorf("%s must be an integer, got %q", key, val)
    }
    
    return i, nil
}

// Usage
days, err := getInt(r, "days", 7)
if err != nil {
    RespondError(w, http.StatusBadRequest, "invalid query parameter", err.Error())
    return
}

if days < 1 || days > 365 {
    RespondError(w, http.StatusBadRequest, "days out of range", "days must be between 1 and 365")
    return
}
```

## CORS Headers (Optional)

If frontend and backend are on different domains:

```go
func CORSMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
        
        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusOK)
            return
        }
        
        next.ServeHTTP(w, r)
    })
}

// Use in main.go
router := api.NewRouter(store, hub)
wrappedRouter := CORSMiddleware(router)
http.ListenAndServe(":8765", wrappedRouter)
```

## Rate Limiting

For public APIs, rate limit expensive operations:

```go
import "golang.org/x/time/rate"

type RateLimiter struct {
    limiters map[string]*rate.Limiter
    mu sync.RWMutex
}

func (rl *RateLimiter) Allow(clientID string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()
    
    if rl.limiters[clientID] == nil {
        rl.limiters[clientID] = rate.NewLimiter(100, 10) // 100 req/sec, burst 10
    }
    
    return rl.limiters[clientID].Allow()
}

// Usage
limiter := &RateLimiter{limiters: make(map[string]*rate.Limiter)}

func InsightsHandler(store *store.Store, limiter *RateLimiter) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        clientIP := r.RemoteAddr
        
        if !limiter.Allow(clientIP) {
            http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
            return
        }
        
        // ... handler logic ...
    }
}
```

## Testing Endpoints

Create `internal/api/handlers_test.go`:

```go
package api

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestModelsHandler(t *testing.T) {
    // Create mock store
    store := &mockStore{}
    
    // Create handler
    handler := ModelsHandler(store)
    
    // Make request
    req := httptest.NewRequest("GET", "/api/models", nil)
    w := httptest.NewRecorder()
    
    handler.ServeHTTP(w, req)
    
    // Assert response
    if w.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", w.Code)
    }
    
    if w.Header().Get("Content-Type") != "application/json" {
        t.Error("expected JSON content-type")
    }
}
```

## API Versioning

For future-proofing, use version prefixes:

```go
// Current
mux.HandleFunc("/api/health", HealthHandler)

// Versioned (prepare for v2)
mux.HandleFunc("/api/v1/health", HealthHandler)
mux.HandleFunc("/api/v2/health", HealthHandlerV2)
```

Changelog:
```
GET /api/v1/stats → Returns JSON
GET /api/v2/stats → Returns JSON + extra fields (backward compatible)
```

## Documentation

Add godoc comments:

```go
// ModelsHandler returns token usage aggregated by model.
//
// Query parameters:
//   none
//
// Response:
//   {
//     "models": [
//       {"model": "haiku", "sessions": 5, "input_tokens": 1000, "output_tokens": 500}
//     ]
//   }
func ModelsHandler(store *store.Store) http.HandlerFunc {
    // ...
}
```

Generate docs:
```bash
godoc -http=:6060
# Visit http://localhost:6060/pkg/ai-sessions/internal/api/
```

## Complete API Reference Template

Document your endpoints:

```markdown
# API Reference

## GET /api/models

Get token usage by model.

**Query Parameters:** None

**Response:**
```json
{
  "models": [
    {"model": "haiku", "sessions": 5, "input_tokens": 1000, "output_tokens": 500},
    {"model": "sonnet", "sessions": 3, "input_tokens": 2000, "output_tokens": 1500}
  ]
}
```

**Status Codes:**
- 200 OK
- 500 Internal Server Error
```

## Next Steps

- **New metrics:** [Adding New Metrics](Dev-Adding-New-Metrics)
- **Testing:** [Testing Requirements](Dev-Testing-Requirements)
- **Architecture:** [System Design Overview](Dev-System-Design-Overview)
