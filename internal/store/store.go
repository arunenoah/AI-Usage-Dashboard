package store

import (
	"math"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/adapters"
	"github.com/ai-sessions/ai-sessions/internal/models"
)

// Correct Claude Sonnet pricing per million tokens
const (
	priceInputPerM         = 3.0   // regular input
	priceOutputPerM        = 15.0  // output (includes thinking)
	priceCacheReadPerM     = 0.30  // cache read (cheap)
	priceCacheCreationPerM = 3.75  // cache write (more expensive than input)
)

type Store struct {
	mu       sync.RWMutex
	sessions map[string]*models.Session
}

func New() *Store {
	return &Store{sessions: make(map[string]*models.Session)}
}

func (s *Store) Upsert(session *models.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.ID] = session
}

func (s *Store) Get(id string) *models.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.sessions[id]
}

func (s *Store) LoadAll(adapter adapters.Adapter) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	paths := adapter.Detect(home)
	for _, p := range paths {
		sess, err := adapter.Parse(p)
		if err != nil {
			continue
		}
		s.Upsert(sess)
	}
	return nil
}

func (s *Store) Sessions() []*models.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.Session, 0, len(s.sessions))
	for _, v := range s.sessions {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].StartTime.After(out[j].StartTime)
	})
	return out
}

func (s *Store) Stats() models.Stats {
	sessions := s.Sessions()
	if len(sessions) == 0 {
		return models.Stats{ToolCounts: make(map[string]int), Daily: []models.DailyStats{}}
	}

	stats := models.Stats{
		TotalSessions: len(sessions),
		ToolCounts:    make(map[string]int),
	}

	// Active session: modified within last 30 minutes
	if len(sessions) > 0 && time.Since(sessions[0].EndTime) < 30*time.Minute {
		stats.ActiveSession = sessions[0]
	}

	dailyMap := make(map[string]*models.DailyStats)

	for _, sess := range sessions {
		stats.TotalInputTokens += sess.TotalUsage.InputTokens
		stats.TotalOutputTokens += sess.TotalUsage.OutputTokens
		stats.TotalCacheReadTokens += int64(sess.TotalUsage.CacheReadInputTokens)
		stats.TotalCacheCreationTokens += sess.TotalUsage.CacheCreationInputTokens

		cost := tokenCost(sess.TotalUsage)
		stats.TotalCostUSD += cost

		for tool, count := range sess.ToolCounts {
			stats.ToolCounts[tool] += count
		}

		day := sess.StartTime.Format("2006-01-02")
		if day == "0001-01-01" {
			continue // skip zero-time sessions
		}
		if _, ok := dailyMap[day]; !ok {
			dailyMap[day] = &models.DailyStats{Date: day}
		}
		d := dailyMap[day]
		d.InputTokens += sess.TotalUsage.InputTokens
		d.OutputTokens += sess.TotalUsage.OutputTokens
		d.CacheRead += int64(sess.TotalUsage.CacheReadInputTokens)
		d.CacheCreation += sess.TotalUsage.CacheCreationInputTokens
		d.Sessions++
		d.EstCostUSD += cost
	}

	for _, d := range dailyMap {
		stats.Daily = append(stats.Daily, *d)
	}
	sort.Slice(stats.Daily, func(i, j int) bool {
		return stats.Daily[i].Date < stats.Daily[j].Date
	})
	if len(stats.Daily) > 30 {
		stats.Daily = stats.Daily[len(stats.Daily)-30:]
	}

	if len(sessions) > 0 {
		stats.AvgSessionTokens = (stats.TotalInputTokens + stats.TotalOutputTokens) / len(sessions)
	}

	stats.TotalCostUSD = math.Round(stats.TotalCostUSD*100) / 100
	return stats
}

func tokenCost(u models.Usage) float64 {
	return float64(u.InputTokens)/1e6*priceInputPerM +
		float64(u.OutputTokens)/1e6*priceOutputPerM +
		float64(u.CacheReadInputTokens)/1e6*priceCacheReadPerM +
		float64(u.CacheCreationInputTokens)/1e6*priceCacheCreationPerM
}
