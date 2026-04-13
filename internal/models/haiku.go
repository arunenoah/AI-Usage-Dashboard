package models

import "time"

// HaikuImprovement is one actionable prompt improvement from Haiku
type HaikuImprovement struct {
	Pattern    string `json:"pattern"`
	ExampleFix string `json:"example_fix"`
	Impact     string `json:"impact"` // "high" | "medium"
}

// HaikuRewrite is a full before/after rewrite of the user's weakest prompt
type HaikuRewrite struct {
	Original string `json:"original"`
	Improved string `json:"improved"`
	Why      string `json:"why"`
}

// HaikuAnalysis is the structured response from Claude Haiku
type HaikuAnalysis struct {
	TierJustification string             `json:"tier_justification"`
	TopImprovements   []HaikuImprovement `json:"top_improvements"`
	Strengths         []string           `json:"strengths"`
	Rewrite           *HaikuRewrite      `json:"rewrite,omitempty"`
	AnalyzedAt        time.Time          `json:"analyzed_at"`
	PromptCount       int                `json:"prompt_count"`
}

// HaikuCache is persisted to ~/.claude/ai-sessions-haiku-cache.json
type HaikuCache struct {
	Analysis   *HaikuAnalysis `json:"analysis"`
	AnalyzedAt time.Time      `json:"analyzed_at"`
	PromptHash string         `json:"prompt_hash"`
}
