package models

// TaskItem is one task from ~/.claude/tasks/{sessionID}/{n}.json
type TaskItem struct {
	ID          string   `json:"id"`
	Subject     string   `json:"subject"`
	Description string   `json:"description"`
	ActiveForm  string   `json:"active_form"`
	Status      string   `json:"status"` // "completed" | "in_progress" | "pending"
	Blocks      []string `json:"blocks"`
	BlockedBy   []string `json:"blocked_by"`
	SessionID   string   `json:"session_id"`
	SessionDate string   `json:"session_date"` // "2006-01-02"
	ProjectDir  string   `json:"project_dir"`
}

// ProjectTaskSummary aggregates tasks for one project
type ProjectTaskSummary struct {
	ProjectDir     string     `json:"project_dir"`
	Completed      int        `json:"completed"`
	InProgress     int        `json:"in_progress"`
	Pending        int        `json:"pending"`
	CompletionRate int        `json:"completion_rate"` // 0-100
	Tasks          []TaskItem `json:"tasks"`
}

// TasksResponse is returned by GET /api/tasks
type TasksResponse struct {
	Projects []ProjectTaskSummary `json:"projects"`
	Summary  TasksSummary         `json:"summary"`
}

type TasksSummary struct {
	Total      int `json:"total"`
	Completed  int `json:"completed"`
	InProgress int `json:"in_progress"`
	Pending    int `json:"pending"`
}
