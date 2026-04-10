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
	return s.StatsForRange(time.Time{}, time.Time{})
}

// StatsForDays returns stats filtered to the last N days (0 = all time).
func (s *Store) StatsForDays(days int) models.Stats {
	if days <= 0 {
		return s.StatsForRange(time.Time{}, time.Time{})
	}
	from := time.Now().Truncate(24 * time.Hour).AddDate(0, 0, -(days - 1))
	return s.StatsForRange(from, time.Time{})
}

// StatsForRange returns stats for sessions between from and to (zero = unbounded).
func (s *Store) StatsForRange(from, to time.Time) models.Stats {
	allSessions := s.Sessions()
	if len(allSessions) == 0 {
		return models.Stats{ToolCounts: make(map[string]int), Daily: []models.DailyStats{}, Projects: []string{}}
	}

	sessions := allSessions
	if !from.IsZero() || !to.IsZero() {
		sessions = make([]*models.Session, 0, len(allSessions))
		for _, sess := range allSessions {
			if !from.IsZero() && sess.StartTime.Before(from) {
				continue
			}
			if !to.IsZero() && sess.StartTime.After(to) {
				continue
			}
			sessions = append(sessions, sess)
		}
	}

	st := models.Stats{
		TotalSessions: len(sessions),
		TotalAllSessions: len(allSessions),
		ToolCounts:    make(map[string]int),
	}

	// Active session: modified within last 30 minutes (use all sessions for live detection)
	if len(allSessions) > 0 && time.Since(allSessions[0].EndTime) < 30*time.Minute {
		st.ActiveSession = allSessions[0]
	}

	// Unique projects
	projectSet := make(map[string]struct{})
	dailyMap := make(map[string]*models.DailyStats)

	for _, sess := range sessions {
		st.TotalInputTokens += sess.TotalUsage.InputTokens
		st.TotalOutputTokens += sess.TotalUsage.OutputTokens
		st.TotalCacheReadTokens += int64(sess.TotalUsage.CacheReadInputTokens)
		st.TotalCacheCreationTokens += sess.TotalUsage.CacheCreationInputTokens

		cost := tokenCost(sess.TotalUsage)
		st.TotalCostUSD += cost

		for tool, count := range sess.ToolCounts {
			st.ToolCounts[tool] += count
		}

		if sess.ProjectDir != "" {
			projectSet[sess.ProjectDir] = struct{}{}
		}

		day := sess.StartTime.Format("2006-01-02")
		if day == "0001-01-01" {
			continue
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
		st.Daily = append(st.Daily, *d)
	}
	sort.Slice(st.Daily, func(i, j int) bool {
		return st.Daily[i].Date < st.Daily[j].Date
	})

	for p := range projectSet {
		st.Projects = append(st.Projects, p)
	}
	sort.Strings(st.Projects)

	if len(sessions) > 0 {
		st.AvgSessionTokens = (st.TotalInputTokens + st.TotalOutputTokens) / len(sessions)
		st.AvgSessionCostUSD = math.Round(st.TotalCostUSD/float64(len(sessions))*1000) / 1000
	}

	st.TotalCostUSD = math.Round(st.TotalCostUSD*100) / 100
	return st
}

func tokenCost(u models.Usage) float64 {
	return float64(u.InputTokens)/1e6*priceInputPerM +
		float64(u.OutputTokens)/1e6*priceOutputPerM +
		float64(u.CacheReadInputTokens)/1e6*priceCacheReadPerM +
		float64(u.CacheCreationInputTokens)/1e6*priceCacheCreationPerM
}
