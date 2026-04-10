package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/ai-sessions/ai-sessions/internal/store"
)

type Handler struct {
	Store *store.Store
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/stats", h.getStats)
	mux.HandleFunc("/api/sessions", h.getSessions)
	mux.HandleFunc("/api/tools", h.getTools)
	mux.HandleFunc("/api/health", h.health)
}

func (h *Handler) getStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, h.Store.Stats())
}

func (h *Handler) getSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	sessions := h.Store.Sessions()

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 20
	}
	start := (page - 1) * limit
	end := start + limit
	if start >= len(sessions) {
		writeJSON(w, map[string]any{"sessions": []any{}, "total": len(sessions), "page": page})
		return
	}
	if end > len(sessions) {
		end = len(sessions)
	}
	writeJSON(w, map[string]any{
		"sessions": sessions[start:end],
		"total":    len(sessions),
		"page":     page,
	})
}

func (h *Handler) getTools(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	stats := h.Store.Stats()
	writeJSON(w, stats.ToolCounts)
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_ = json.NewEncoder(w).Encode(v)
}
