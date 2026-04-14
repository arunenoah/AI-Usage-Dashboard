# Adding New Metrics

How to compute and expose custom metrics in the dashboard.

## What is a Metric?

A metric is any aggregated statistic:
- **Sessions:** Total number of sessions
- **Tokens Used:** Total input + output tokens
- **Output Ratio:** Output / (Input + Output)
- **Tool Breadth:** Count of distinct tools
- **Prompt Specificity:** Average CARE score
- **Peak Hour:** Hour with most tokens (example custom metric)

## Metric Types

### 1. Simple Aggregate (Total)

Computed from all sessions in a time range.

**Example: Total Tokens**
```go
totalTokens := 0
for _, session := range sessions {
    totalTokens += session.InputTokens + session.OutputTokens
}
```

### 2. Time-Series (Daily)

Broken down by day.

**Example: Daily Token Breakdown**
```go
dailyTokens := map[string]int{
    "2026-04-14": 5000,
    "2026-04-13": 4200,
    "2026-04-12": 6100,
}
```

### 3. Categorical (By Project, Tool)

Grouped by a dimension.

**Example: Tokens by Project**
```go
projectTokens := map[string]int{
    "webapp": 15000,
    "cli": 8000,
    "docs": 2000,
}
```

### 4. Ratio / Percentage

Computed from other metrics.

**Example: Output Ratio**
```go
outputRatio := float64(outputTokens) / float64(inputTokens + outputTokens)
// Result: 0.67 (67% of tokens are outputs)
```

### 5. Derived / Computed

AI-generated insights or correlations.

**Example: Peak Hour (custom)**
```go
peakHour := 14  // Most tokens written at 2 PM
```

## Step-by-Step: Add a Custom Metric

Let's add **"Peak Hour"** — the hour of day with the most conversation activity.

### Step 1: Extend the Models

Add to `internal/models/models.go`:

```go
type Stats struct {
    TotalSessions    int
    TotalTokens      int
    OutputRatio      float64
    DailyMetrics     []DailyMetric
    TopTools         []ToolMetric
    PeakHour         int          // NEW: Hour (0-23) with most tokens
    PeakHourTokens   int          // NEW: Tokens in peak hour
    // ... existing fields ...
}

type DailyMetric struct {
    Date             string
    Sessions         int
    InputTokens      int
    OutputTokens     int
    // NEW: Hour-level breakdown
    HourlyTokens     map[int]int  // Hour → tokens
}
```

### Step 2: Compute in Store

Edit `internal/store/store.go`, update `GetStats()`:

```go
func (s *Store) GetStats(from, to time.Time) Stats {
    s.mu.RLock()
    defer s.mu.RUnlock()
    
    var stats Stats
    hourTokens := make(map[int]int)  // Hour → total tokens
    
    for _, session := range s.sessions {
        if session.StartTime.After(from) && session.StartTime.Before(to) {
            stats.TotalSessions++
            
            totalTokens := session.InputTokens + session.OutputTokens
            stats.TotalTokens += totalTokens
            
            // Compute peak hour
            hour := session.StartTime.Hour()
            hourTokens[hour] += totalTokens
            
            // Add other metrics...
        }
    }
    
    // Find peak hour
    maxHour := 0
    maxTokens := 0
    for hour, tokens := range hourTokens {
        if tokens > maxTokens {
            maxTokens = tokens
            maxHour = hour
        }
    }
    stats.PeakHour = maxHour
    stats.PeakHourTokens = maxTokens
    
    // Compute existing metrics...
    if stats.TotalTokens > 0 {
        stats.OutputRatio = float64(stats.OutputTokens) / float64(stats.TotalTokens)
    }
    
    return stats
}
```

### Step 3: Expose via API

Edit `internal/api/handlers.go`:

```go
func StatsHandler(store *store.Store) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Parse query params
        days := r.URL.Query().Get("days")
        if days == "" {
            days = "7"
        }
        
        // Get date range
        to := time.Now()
        from := to.AddDate(0, 0, -parseInt(days))
        
        // Get stats (includes new PeakHour)
        stats := store.GetStats(from, to)
        
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(stats)
    }
}
```

The API response now includes:
```json
{
  "total_sessions": 42,
  "total_tokens": 150000,
  "output_ratio": 0.67,
  "peak_hour": 14,           // NEW
  "peak_hour_tokens": 8900,  // NEW
  "daily_metrics": [...]
}
```

### Step 4: Display in Frontend

Edit `web/src/pages/Dashboard.jsx`:

```jsx
function Dashboard() {
    const [stats, setStats] = useState(null);
    
    useEffect(() => {
        fetch(`/api/stats?days=7`)
            .then(r => r.json())
            .then(stats => setStats(stats));
    }, []);
    
    if (!stats) return <div>Loading...</div>;
    
    return (
        <div className="dashboard">
            {/* Existing KPI cards */}
            <KPICard value={stats.total_sessions} label="Sessions" />
            <KPICard value={stats.total_tokens} label="Tokens Used" />
            
            {/* NEW: Peak Hour card */}
            <KPICard
                value={`${stats.peak_hour}:00`}
                label="Peak Hour"
                subtitle={`${stats.peak_hour_tokens} tokens`}
                icon={<ClockIcon />}
            />
            
            {/* Rest of dashboard */}
        </div>
    );
}
```

### Step 5: Test

```bash
# 1. Build and run
make build
./ai-sessions

# 2. Check API response
curl http://localhost:8765/api/stats?days=7 | jq '.peak_hour'
# Should return an integer (0-23)

# 3. Check UI
# Visit http://localhost:8765
# Should see "Peak Hour" card with time
```

## Advanced: Filtered Metrics

What if you want peak hour **by project**?

### Model Update

```go
type ProjectMetric struct {
    Project      string
    Sessions     int
    Tokens       int
    OutputRatio  float64
    PeakHour     int  // Peak hour for this project
}

type Stats struct {
    // ... existing ...
    ProjectMetrics []ProjectMetric  // NEW
}
```

### Compute in Store

```go
func (s *Store) GetStats(from, to time.Time) Stats {
    // ... existing code ...
    
    projectData := make(map[string]struct {
        sessions int
        tokens int
        hourTokens map[int]int
    })
    
    for _, session := range s.sessions {
        if session.StartTime.After(from) && session.StartTime.Before(to) {
            proj := session.ProjectPath
            data := projectData[proj]
            data.sessions++
            data.tokens += session.InputTokens + session.OutputTokens
            
            hour := session.StartTime.Hour()
            data.hourTokens[hour] += session.InputTokens + session.OutputTokens
            
            projectData[proj] = data
        }
    }
    
    // Convert to ProjectMetric[]
    for proj, data := range projectData {
        maxHour := 0
        maxTokens := 0
        for hour, tokens := range data.hourTokens {
            if tokens > maxTokens {
                maxHour = hour
                maxTokens = tokens
            }
        }
        
        stats.ProjectMetrics = append(stats.ProjectMetrics, ProjectMetric{
            Project: proj,
            Sessions: data.sessions,
            Tokens: data.tokens,
            PeakHour: maxHour,
        })
    }
    
    return stats
}
```

## Performance Tips

### 1. Cache Expensive Metrics

If a metric takes 100ms+ to compute, cache it:

```go
type Store struct {
    // ... existing ...
    cachedStats *Stats
    cachedStatsKey string
    statsCacheTTL time.Time
}

func (s *Store) GetStats(from, to time.Time) Stats {
    key := from.String() + to.String()
    
    // Return cached if still valid
    if key == s.cachedStatsKey && time.Now().Before(s.statsCacheTTL) {
        return *s.cachedStats
    }
    
    // Recompute
    stats := s.computeStats(from, to)
    
    // Cache for 5 minutes
    s.cachedStats = &stats
    s.cachedStatsKey = key
    s.statsCacheTTL = time.Now().Add(5 * time.Minute)
    
    return stats
}
```

### 2. Compute on-Demand in API Layer

Move expensive logic to API handler, not Store:

```go
// Bad: Store computes too much
func (s *Store) GetDeeplyNestedMetric() { ... }

// Good: API handler computes, uses Store for raw data
func DeeplyNestedHandler(w http.ResponseWriter, r *http.Request) {
    sessions := store.GetSessions()  // Raw data
    
    // API layer computes complex metric
    result := expensiveComputation(sessions)
    
    json.NewEncoder(w).Encode(result)
}
```

### 3. Incremental Updates

When a session is added, update aggregates instead of recomputing:

```go
func (s *Store) Upsert(session *Session) {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    s.sessions[session.ID] = session
    
    // Incrementally update aggregates
    s.totalSessions++
    s.totalTokens += session.InputTokens + session.OutputTokens
    
    // Update daily metric
    dateKey := session.StartTime.Format("2006-01-02")
    s.dailyStats[dateKey].InputTokens += session.InputTokens
    s.dailyStats[dateKey].OutputTokens += session.OutputTokens
    
    // Don't recompute everything!
}
```

## Built-in Metrics Reference

| Metric | Type | Computed | Unit |
|--------|------|----------|------|
| Sessions | Aggregate | Count | integer |
| Tokens Used | Aggregate | Sum | integer |
| Output Ratio | Ratio | Output / Total | float 0-1 |
| Daily Metrics | Time-series | Per-day aggregate | daily |
| Top Tools | Categorical | Count by tool | integer |
| Context Health | Derived | Window fill % | percent |
| Tool Breadth | Aggregate | Distinct tools | integer |
| Prompt Specificity | Derived | Avg CARE score | 1-10 |
| Peak Hour | Derived | Hour with most tokens | 0-23 |

## Next Steps

- **API extensions:** [API Extensions](Dev-API-Extensions)
- **Testing:** [Testing Requirements](Dev-Testing-Requirements)
- **Data flow:** [Data Flow & State Management](Dev-Data-Flow)
