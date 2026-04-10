package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/ai-sessions/ai-sessions/internal/adapters/claudecode"
	"github.com/ai-sessions/ai-sessions/internal/models"
	"github.com/ai-sessions/ai-sessions/internal/store"
)

type Handler struct {
	Store   *store.Store
	Adapter *claudecode.Adapter
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/stats", h.getStats)
	mux.HandleFunc("/api/sessions", h.getSessions)
	mux.HandleFunc("/api/sessions/", h.getSessionDetail) // handles /api/sessions/:id/turns
	mux.HandleFunc("/api/tools", h.getTools)
	mux.HandleFunc("/api/system", h.getSystemInfo)
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
	if limit < 1 || limit > 500 {
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

// getSessionDetail handles GET /api/sessions/:id/turns
func (h *Handler) getSessionDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// Parse: /api/sessions/<id>/turns
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/sessions/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "session ID required", http.StatusBadRequest)
		return
	}
	sessionID := parts[0]

	sess := h.Store.Get(sessionID)
	if sess == nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	turns, err := h.Adapter.ParseTurns(sess.FilePath)
	if err != nil {
		http.Error(w, "parse error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"session": sess,
		"turns":   turns,
	})
}

func (h *Handler) getTools(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, h.Store.Stats().ToolCounts)
}

func (h *Handler) getSystemInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	home, _ := os.UserHomeDir()
	info := models.SystemInfo{}

	// Read settings.json
	settingsPath := filepath.Join(home, ".claude", "settings.json")
	if data, err := os.ReadFile(settingsPath); err == nil {
		var s struct {
			EnabledPlugins        map[string]bool `json:"enabledPlugins"`
			AlwaysThinkingEnabled bool            `json:"alwaysThinkingEnabled"`
		}
		if json.Unmarshal(data, &s) == nil {
			for k, v := range s.EnabledPlugins {
				if v {
					// Extract plugin name before @
					name := strings.SplitN(k, "@", 2)[0]
					info.EnabledPlugins = append(info.EnabledPlugins, name)
				}
			}
			info.AlwaysThinkingEnabled = s.AlwaysThinkingEnabled
		}
	}

	// Read mcp.json for MCP servers
	mcpPath := filepath.Join(home, ".claude", "mcp.json")
	if data, err := os.ReadFile(mcpPath); err == nil {
		var m struct {
			MCPServers map[string]any `json:"mcpServers"`
		}
		if json.Unmarshal(data, &m) == nil {
			for k := range m.MCPServers {
				info.MCPServers = append(info.MCPServers, k)
			}
		}
	}

	// Count session files
	projectsDir := filepath.Join(home, ".claude", "projects")
	var sessionFiles, projectDirs int
	_ = filepath.Walk(projectsDir, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if fi.IsDir() && path != projectsDir {
			projectDirs++
		}
		if !fi.IsDir() && strings.HasSuffix(path, ".jsonl") {
			sessionFiles++
		}
		return nil
	})
	info.TotalSessionFiles = sessionFiles
	info.TotalProjectDirs = projectDirs

	// Count plans
	plansDir := filepath.Join(home, ".claude", "plans")
	if entries, err := os.ReadDir(plansDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".md") {
				info.PlanCount++
			}
		}
	}

	// Count tasks
	tasksDir := filepath.Join(home, ".claude", "tasks")
	if entries, err := os.ReadDir(tasksDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				info.TaskCount++
			}
		}
	}

	writeJSON(w, info)
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_ = json.NewEncoder(w).Encode(v)
}
