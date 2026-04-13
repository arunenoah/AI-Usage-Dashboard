package api

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ai-sessions/ai-sessions/internal/models"
)

const haikuCacheFile = ".claude/ai-sessions-haiku-cache.json"
const haikuCacheTTL = 24 * time.Hour
const haikuModel = "claude-haiku-4-5-20251001"

// loadHaikuCache reads the on-disk cache; returns nil if missing or expired.
func loadHaikuCache() *models.HaikuCache {
	home, _ := os.UserHomeDir()
	data, err := os.ReadFile(filepath.Join(home, haikuCacheFile))
	if err != nil {
		return nil
	}
	var c models.HaikuCache
	if err := json.Unmarshal(data, &c); err != nil {
		return nil
	}
	if time.Since(c.AnalyzedAt) > haikuCacheTTL {
		return nil
	}
	return &c
}

// saveHaikuCache writes the cache atomically.
func saveHaikuCache(c *models.HaikuCache) {
	home, _ := os.UserHomeDir()
	data, err := json.Marshal(c)
	if err != nil {
		return
	}
	path := filepath.Join(home, haikuCacheFile)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return
	}
	_ = os.Rename(tmp, path)
}

// promptHash returns a short SHA-256 fingerprint of the prompt sample.
func promptHash(prompts []string) string {
	h := sha256.New()
	for _, p := range prompts {
		h.Write([]byte(p))
		h.Write([]byte{0})
	}
	return fmt.Sprintf("%x", h.Sum(nil))[:16]
}

// callHaiku calls Claude Haiku with a sample of prompts and returns structured analysis.
func callHaiku(promptSamples []string) (*models.HaikuAnalysis, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY not set")
	}
	if len(promptSamples) == 0 {
		return nil, fmt.Errorf("no prompts to analyze")
	}

	var sb strings.Builder
	for i, p := range promptSamples {
		fmt.Fprintf(&sb, "%d. %s\n\n", i+1, p)
	}

	systemPrompt := `You are an expert at analyzing how developers use Claude Code.
Analyze the user's prompts and return a JSON object with exactly this structure (no markdown, raw JSON only):
{
  "tier_justification": "one sentence explaining the overall tier",
  "top_improvements": [
    {"pattern": "what they do wrong", "example_fix": "before → after one-liner", "impact": "high"},
    {"pattern": "second issue", "example_fix": "before → after", "impact": "medium"}
  ],
  "strengths": ["what they do well (max 2 items)"],
  "rewrite": {
    "original": "copy the weakest prompt verbatim",
    "improved": "your improved version",
    "why": "one sentence explanation"
  }
}
Only return the JSON. No explanation, no markdown fences.`

	userMsg := fmt.Sprintf("Here are %d recent Claude Code prompts from this developer:\n\n%sAnalyze these prompts and return the JSON.", len(promptSamples), sb.String())

	reqBody, _ := json.Marshal(map[string]any{
		"model":      haikuModel,
		"max_tokens": 1024,
		"system":     systemPrompt,
		"messages": []map[string]any{
			{"role": "user", "content": userMsg},
		},
	})

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var apiResp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}
	if apiResp.Error != nil {
		return nil, fmt.Errorf("anthropic API error: %s", apiResp.Error.Message)
	}
	if len(apiResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from Haiku")
	}

	raw := strings.TrimSpace(apiResp.Content[0].Text)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var analysis models.HaikuAnalysis
	if err := json.Unmarshal([]byte(raw), &analysis); err != nil {
		return nil, fmt.Errorf("parse haiku JSON: %w (raw: %.200s)", err, raw)
	}
	analysis.AnalyzedAt = time.Now()
	analysis.PromptCount = len(promptSamples)
	return &analysis, nil
}

// samplePrompts pulls up to maxN recent non-trivial first prompts from sessions.
func samplePrompts(sessions []*models.Session, maxN int) []string {
	var out []string
	for _, s := range sessions {
		p := strings.TrimSpace(s.FirstPrompt)
		if len(p) < 10 {
			continue
		}
		if strings.HasPrefix(p, "Base directory") || strings.HasPrefix(p, "<command") {
			continue
		}
		out = append(out, p)
		if len(out) >= maxN {
			break
		}
	}
	return out
}
