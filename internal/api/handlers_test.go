package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/models"
	"github.com/ai-sessions/ai-sessions/internal/store"
)

func newTestHandler() *Handler {
	s := store.New()
	s.Upsert(&models.Session{
		ID:          "test-session-1",
		ProjectDir:  "/dev/myapp",
		Source:      "claude-code",
		StartTime:   time.Now().Add(-1 * time.Hour),
		EndTime:     time.Now(),
		UserTurns:   3,
		AssistTurns: 3,
		TotalUsage:  models.Usage{InputTokens: 50_000, OutputTokens: 2_000},
		ToolCounts:  map[string]int{"Read": 5, "Bash": 2},
	})
	return &Handler{Store: s}
}

func TestGetStats(t *testing.T) {
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	rr := httptest.NewRecorder()
	h.getStats(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	var stats models.Stats
	if err := json.NewDecoder(rr.Body).Decode(&stats); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if stats.TotalSessions != 1 {
		t.Errorf("expected 1 session, got %d", stats.TotalSessions)
	}
}

func TestGetSessions(t *testing.T) {
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/sessions?page=1&limit=10", nil)
	rr := httptest.NewRecorder()
	h.getSessions(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var result map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if result["total"].(float64) != 1 {
		t.Errorf("expected total=1, got %v", result["total"])
	}
}
