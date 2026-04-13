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

// MetricsContext holds computed metrics passed into Haiku for insight generation.
type MetricsContext struct {
	OutputRatio      float64
	AgentUsagePct    float64
	SpecificPct      float64
	AvgToolDiversity float64
	TopTools         []string // e.g. ["Bash:2917", "Read:1840"]
	OverallTier      string
	TotalSessions    int
	HighCtxSessions  int
}

// callHaiku calls Claude Haiku with prompt samples + live metrics and returns structured analysis.
func callHaiku(promptSamples []string, metrics MetricsContext) (*models.HaikuAnalysis, error) {
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

	metricsBlock := fmt.Sprintf(`Current metrics for this developer:
- Overall tier: %s
- Output ratio: %.1f× (input→output tokens) [Expert = 3×+]
- Agent delegation: %.0f%% of sessions use subagents [Expert = 30%%+]
- Prompt specificity: %.0f%% of prompts reference exact files/functions [Expert = 60%%+]
- Tool breadth: %.1f unique tools/session [Expert = 7+]
- Top tools used: %s
- Total sessions analysed: %d
- Sessions over 50 turns: %d`,
		metrics.OverallTier,
		metrics.OutputRatio,
		metrics.AgentUsagePct,
		metrics.SpecificPct,
		metrics.AvgToolDiversity,
		strings.Join(metrics.TopTools, ", "),
		metrics.TotalSessions,
		metrics.HighCtxSessions,
	)

	systemPrompt := `You are an expert at analysing how developers use Claude Code.
You will receive live usage metrics AND a sample of the developer's actual prompts.
Generate actionable insights that are 100% specific to their real numbers and real prompt patterns.

Return a JSON object with exactly this structure (raw JSON only, no markdown):
{
  "tier_justification": "one sentence citing their actual weakest metric with its real value",
  "insights": [
    {
      "type": "warning|info|success",
      "title": "short specific title (not generic)",
      "text": "2-3 sentences: what their data shows, why it matters, one concrete action referencing their actual tools and workflow"
    }
  ],
  "strengths": ["one specific thing they do well, with their real value"],
  "rewrite": {
    "original": "copy the weakest prompt from the sample verbatim",
    "improved": "your improved version of that exact prompt",
    "why": "one sentence explanation"
  }
}

Rules:
- Generate 3-5 insights covering each metric dimension (output ratio, agent delegation, specificity, tool breadth)
- Use their real numbers in every insight text (e.g. "Your 11% agent usage..." not "You underuse agents...")
- Reference the actual tools they use most (from top tools list) in advice
- For metrics at Expert tier, write a "success" insight celebrating that with the real value
- For metrics below Advanced, write "warning" or "info" with a concrete next step
- Never use generic advice that would apply to any user — always anchor to their actual data
- The rewrite must use a real prompt from their sample, not a made-up example`

	userMsg := fmt.Sprintf("%s\n\nRecent Claude Code prompts from this developer (%d total):\n\n%s\nAnalyze and return the JSON.",
		metricsBlock, len(promptSamples), sb.String())

	reqBody, _ := json.Marshal(map[string]any{
		"model":      haikuModel,
		"max_tokens": 2048,
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
