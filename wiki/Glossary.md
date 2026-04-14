# Glossary

## Core Concepts

### CARE Framework
A structured way to evaluate prompt quality on a scale of 1-10:
- **[C] Context (0-2 pts):** Does the prompt set up file paths, function names, role/persona?
- **[A] Ask (0-3 pts):** Clear action verb, detailed instruction, multi-step request?
- **[R] Rules (0-2 pts):** Constraints, boundaries, expected behavior, acceptance criteria?
- **[E] Examples (0-2 pts):** Desired output format, code examples, before/after patterns?

**Score meanings:**
- 1-4 Weak: Missing most dimensions, vague instructions
- 5-6 Needs Work: Has structure but missing critical details
- 7-8 Decent: Mostly well-structured, minor gaps
- 9-10 Good: Comprehensive, actionable, well-scoped

**See also:** [CARE Scoring Explained](User-CARE-Scoring-Explained)

### Session
A single `.jsonl` file containing one user's conversation history with Claude Code, including:
- User and assistant messages (turns)
- Token usage (input and output)
- Tool calls and results
- Timing information
- Project path and model information

**Location:** `~/.claude/projects/*/session-*.jsonl`

### Turn
A single user message + Claude response pair within a session. Each turn has:
- User input (prompt)
- Claude output (response)
- Token counts
- Tool calls (if any)
- Timing

### Tokens
Units of text processed by Claude's model:
- **Input tokens:** Your prompt (what you send to Claude)
- **Output tokens:** Claude's response (what you receive)
- **Total tokens:** Sum of input + output

**Why it matters:** Token consumption = API usage cost, context window constraints, quality/speed trade-offs.

**See also:** [Token Metrics & Cache](User-Token-Metrics)

### Cache Hit Rate
Percentage of tokens served from a cached context rather than newly processed. Reusing complex contexts (like large files or system prompts) saves tokens and money.

**Example:** If 100 tokens are cached and 50 new tokens are processed, cache hit rate = 100/(100+50) = 66.7%

### Adapter
A parser module for a specific session source. The dashboard supports multiple sources (Claude Code, Copilot, Windsurf, Cursor) via the adapter interface.

**Current adapters:**
- Claude Code: Parses `~/.claude/projects/*/session-*.jsonl`
- GitHub Copilot: Parses Copilot session logs
- Windsurf (stub): Ready for implementation
- OpenCode (stub): Ready for implementation

**See also:** [Adapter Development Guide](Dev-Adapter-Development-Guide)

### Tier / Skill Level
A classification of prompt quality based on CARE scoring:
- **Beginner:** 1-3 average score. Weak prompts, vague instructions.
- **Intermediate:** 4-6 average score. Some structure, room for improvement.
- **Advanced:** 7-8 average score. Well-structured, minor gaps.
- **Expert:** 9-10 average score. Comprehensive, actionable prompts consistently.

**See also:** [Interpreting Insights](User-Interpreting-Insights)

---

## System & Architecture

### Store
The in-memory session database. Holds all parsed sessions indexed by date, project, source type. Computes aggregate statistics like totals, daily metrics, insights.

**Responsibility:** Load sessions from adapters → index → aggregate → expose via API.

### WebSocket
Real-time update mechanism. When a session file is updated on disk:
1. File watcher detects change
2. Adapter reparses the file
3. Store updates the in-memory session
4. WebSocket hub broadcasts `session_updated` event
5. Dashboard UI updates live

**See also:** [Data Flow & State Management](Dev-Data-Flow)

### Metric
Any aggregated statistic displayed in the dashboard. Examples:
- **Sessions:** Total number of sessions
- **Tokens Used:** Total input + output tokens
- **Output Ratio:** Output tokens / (input + output)
- **Tool Breadth:** Number of distinct tools used
- **Prompt Specificity:** Average CARE score

**See also:** [Adding New Metrics](Dev-Adding-New-Metrics)

---

## UI Concepts

### Widget
A UI component displaying a specific metric or feature. Examples:
- KPI cards (Sessions, Tokens Used, etc.)
- Token trend area chart
- Session explorer table
- CARE score ring
- Prompt examples drawer

### Drawer / Panel
A slide-out panel or modal that displays detailed information. Examples:
- Session detail drawer
- Prompt examples panel
- Tool samples drawer

### Insight / PromptScore
AI-generated feedback on your prompting style. Includes:
- Tier classification (Beginner → Expert)
- Per-dimension analysis (Context, Ask, Rules, Examples)
- Path to next tier with real prompt examples
- Peer benchmarks

**See also:** [Interpreting Insights](User-Interpreting-Insights)

---

## Related Resources

- **README:** [arunenoah/AI-Usage-Dashboard](https://github.com/arunenoah/AI-Usage-Dashboard) — Quick reference and API docs
- **Main Wiki:** Home page with all sections
- **GitHub Issues:** Report terms that are unclear or add new ones
