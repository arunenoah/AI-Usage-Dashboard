# Dashboard Overview

A tour of every widget and metric on the main dashboard.

## Top Section: Key Performance Indicators (KPI Cards)

### Sessions
**What it shows:** Total number of Claude Code sessions you've had.

**Why it matters:** How active are you with Claude Code? Higher = more frequent usage.

**Example:** If it shows "127", you've created 127 sessions.

### Tokens Used
**What it shows:** Total input + output tokens across all sessions.

**Breakdown:** Shows input (purple) and output (green) separately.

**Why it matters:** Token usage = context consumed, quality of responses. More tokens = more information processed or longer conversations.

**Example:** "285.3K tokens" = you've used 285,300 tokens total.

### Projects
**What it shows:** Number of distinct projects you've worked on (folder names in `~/.claude/projects/`).

**Why it matters:** Are you focused on 1-2 projects, or scattered across many?

**Example:** If it shows "8", you've worked on 8 different projects.

### Tool Calls
**What it shows:** Total number of tools Claude used across all sessions (file reads, bash commands, etc.).

**Why it matters:** How much did Claude help with automation? More = more productive.

**Example:** If it shows "1,245", Claude made 1,245 tool calls total.

---

## Middle Section: Token Trend Chart

**What it shows:** Input (purple) and output (green) tokens over time, day by day.

**X-axis:** Dates (last 7 days, 30 days, or custom range)

**Y-axis:** Token count

**Why it matters:** See your usage patterns. Spikes = busy days. Trends = are you using more Claude over time?

**Toggle buttons:**
- **7d:** Last 7 days
- **30d:** Last 30 days
- **Custom:** Pick a date range

**Metrics below the chart:**
- **Output Ratio:** Output tokens / (input + output). Higher = more response content.
- **Cache Hit Rate:** Percentage of tokens served from cache (reused context). Higher = more efficient, lower costs.

---

## Below the Chart: 7-Day Heatmap

**What it shows:** Daily input (top half) and output (bottom half) token volume as color-coded tiles.

**Colors:** Darker = more tokens, lighter = fewer tokens.

**Why it matters:** Quick visual of which days you used most tokens. Helps spot patterns.

**Example:** Monday might be dark (heavy work), Saturday light (less activity).

---

## Session Explorer Table

**What it shows:** A searchable list of all your sessions, newest first.

**Columns:**
- **Date:** When the session was created
- **Project:** Which project folder the session is in
- **Source:** Claude Code, Copilot, Windsurf, etc.
- **Tokens:** Total tokens in that session
- **Score:** CARE prompt quality score (1-10)

**Actions:**
- **Click a row:** Open session detail drawer (see turns, tool calls, token breakdown)
- **Search:** Filter sessions by project name
- **Page:** Navigate through all sessions (15 per page)

**Why it matters:** Dive deep into any session. See exactly what tokens you spent and why.

---

## PromptScore Widget (Top Right)

**What it shows:** Your overall prompt quality tier (Beginner → Expert) and how to improve.

**Sections:**
- **Your Tier:** Based on average CARE score across all conversations
- **Per-dimension scores:** Context, Ask, Rules, Examples (each 0-2 or 0-3 points)
- **Path to Next Tier:** What specifically to improve to reach the next tier
- **Real Examples:** Links to actual bad prompts from your sessions and better versions

**Why it matters:** Learn how to write better prompts by seeing real examples from your own usage.

See [CARE Scoring Explained](User-CARE-Scoring-Explained) for details.

---

## Context Health Widget (Bottom Left)

**What it shows:** How much of your context window is filled in each session.

**Red/Yellow/Green:** Green = plenty of room, Yellow = getting full, Red = nearly full.

**Why it matters:** If context is full, Claude can't see your entire history. This can cause quality issues.

---

## System Info Widget (Bottom Middle)

**What it shows:** Your Claude Code configuration:
- Claude Code version
- Installed plugins and MCP servers
- Session stats (total, recent)

**Why it matters:** Verify your setup is correct. See what tools you have available.

---

## Tasks Widget (Bottom Right)

**What it shows:** Progress on tasks across your projects.

**Visualization:** Ring chart showing completion percentage.

**Why it matters:** See your project progress at a glance.

---

## Navigation

- **Dashboard:** This page (home)
- **Sessions:** Full session explorer with detail views
- **Conversations:** All user→assistant pairs with CARE scores, filterable by quality
- **Settings:** Configure adapters (Copilot, Windsurf, etc.)

---

## Tips

1. **Bookmark** `localhost:8765` for quick access
2. **Set a daily reminder** to check your PromptScore and see if you're improving
3. **Use the Session Explorer** to review high-token sessions and learn what's expensive
4. **Watch your Cache Hit Rate** — reuse contexts to save tokens

---

## Next Steps

- **Understand your CARE score:** [CARE Scoring Explained](User-CARE-Scoring-Explained)
- **Learn from real examples:** [Using Prompt Examples](User-Prompt-Examples)
- **Troubleshoot:** [Troubleshooting & FAQs](User-Troubleshooting-FAQs)
