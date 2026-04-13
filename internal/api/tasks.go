package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/ai-sessions/ai-sessions/internal/models"
)

func (h *Handler) getTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	home, _ := os.UserHomeDir()
	tasksDir := filepath.Join(home, ".claude", "tasks")

	sessions := h.Store.Sessions()
	summary := models.TasksSummary{}
	projectMap := make(map[string]*models.ProjectTaskSummary)

	entries, err := os.ReadDir(tasksDir)
	if err != nil {
		writeJSON(w, models.TasksResponse{
			Projects: []models.ProjectTaskSummary{},
			Summary:  summary,
		})
		return
	}

	for _, sessionDir := range entries {
		if !sessionDir.IsDir() {
			continue
		}
		sessionID := sessionDir.Name()
		sessionPath := filepath.Join(tasksDir, sessionID)

		projectDir := "unknown"
		sessionDate := ""
		for _, sess := range sessions {
			if sess.ID == sessionID {
				projectDir = sess.ProjectDir
				if !sess.StartTime.IsZero() {
					sessionDate = sess.StartTime.Format("2006-01-02")
				}
				break
			}
		}

		taskFiles, err := os.ReadDir(sessionPath)
		if err != nil {
			continue
		}

		for _, tf := range taskFiles {
			if tf.IsDir() || !strings.HasSuffix(tf.Name(), ".json") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(sessionPath, tf.Name()))
			if err != nil {
				continue
			}
			var raw struct {
				ID          string   `json:"id"`
				Subject     string   `json:"subject"`
				Description string   `json:"description"`
				ActiveForm  string   `json:"activeForm"`
				Status      string   `json:"status"`
				Blocks      []string `json:"blocks"`
				BlockedBy   []string `json:"blockedBy"`
			}
			if err := json.Unmarshal(data, &raw); err != nil {
				continue
			}
			if raw.Subject == "" {
				continue
			}

			blocks := raw.Blocks
			if blocks == nil {
				blocks = []string{}
			}
			blockedBy := raw.BlockedBy
			if blockedBy == nil {
				blockedBy = []string{}
			}

			item := models.TaskItem{
				ID:          raw.ID,
				Subject:     raw.Subject,
				Description: raw.Description,
				ActiveForm:  raw.ActiveForm,
				Status:      raw.Status,
				Blocks:      blocks,
				BlockedBy:   blockedBy,
				SessionID:   sessionID,
				SessionDate: sessionDate,
				ProjectDir:  projectDir,
			}

			if _, ok := projectMap[projectDir]; !ok {
				projectMap[projectDir] = &models.ProjectTaskSummary{
					ProjectDir: projectDir,
					Tasks:      []models.TaskItem{},
				}
			}
			p := projectMap[projectDir]
			p.Tasks = append(p.Tasks, item)

			switch raw.Status {
			case "completed":
				p.Completed++
				summary.Completed++
			case "in_progress":
				p.InProgress++
				summary.InProgress++
			default:
				p.Pending++
				summary.Pending++
			}
			summary.Total++
		}
	}

	var projects []models.ProjectTaskSummary
	for _, p := range projectMap {
		total := p.Completed + p.InProgress + p.Pending
		if total > 0 {
			p.CompletionRate = int(float64(p.Completed) / float64(total) * 100)
		}
		sort.SliceStable(p.Tasks, func(i, j int) bool {
			order := map[string]int{"in_progress": 0, "completed": 1, "pending": 2}
			return order[p.Tasks[i].Status] < order[p.Tasks[j].Status]
		})
		projects = append(projects, *p)
	}

	sort.Slice(projects, func(i, j int) bool {
		ti := projects[i].Completed + projects[i].InProgress + projects[i].Pending
		tj := projects[j].Completed + projects[j].InProgress + projects[j].Pending
		return ti > tj
	})

	writeJSON(w, models.TasksResponse{
		Projects: projects,
		Summary:  summary,
	})
}
