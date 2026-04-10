package store

import (
	"testing"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/models"
)

func TestStoreUpsertAndStats(t *testing.T) {
	s := New()
	sess := &models.Session{
		ID:          "abc123",
		ProjectDir:  "/Users/dev/myapp",
		Source:      "claude-code",
		StartTime:   time.Now().Add(-2 * time.Hour),
		EndTime:     time.Now().Add(-1 * time.Hour),
		UserTurns:   5,
		AssistTurns: 5,
		TotalUsage: models.Usage{
			InputTokens:  100_000,
			OutputTokens: 5_000,
		},
		ToolCounts: map[string]int{"Read": 10, "Bash": 3},
	}
	s.Upsert(sess)

	stats := s.Stats()
	if stats.TotalSessions != 1 {
		t.Errorf("want 1 session, got %d", stats.TotalSessions)
	}
	if stats.TotalInputTokens != 100_000 {
		t.Errorf("want 100000 input tokens, got %d", stats.TotalInputTokens)
	}
	if stats.ToolCounts["Read"] != 10 {
		t.Errorf("want Read=10, got %d", stats.ToolCounts["Read"])
	}
	if stats.TotalCostUSD <= 0 {
		t.Error("expected positive cost")
	}
}

func TestStoreSessionsOrder(t *testing.T) {
	s := New()
	now := time.Now()
	s.Upsert(&models.Session{ID: "old", StartTime: now.Add(-2 * time.Hour), ToolCounts: map[string]int{}})
	s.Upsert(&models.Session{ID: "new", StartTime: now.Add(-1 * time.Hour), ToolCounts: map[string]int{}})

	sessions := s.Sessions()
	if sessions[0].ID != "new" {
		t.Errorf("expected newest first, got %s", sessions[0].ID)
	}
}
