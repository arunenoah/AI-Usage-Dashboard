# Token Metrics & Cache Efficiency

Understand tokens and how to use them efficiently.

## What Are Tokens?

Tokens are **units of text** that Claude's model processes. Think of them like "words" but more granular.

### Input Tokens
The tokens in **your prompt** (what you send to Claude).

**Example:** The prompt "Hello, how are you?" is about 6 tokens.

### Output Tokens
The tokens in **Claude's response** (what you receive back).

**Example:** Claude's answer "I'm doing well, thank you for asking." is about 10 tokens.

### Total Tokens
Input + Output = Total tokens for one conversation.

**Why it matters:**
- Token usage = context consumed from your session
- More tokens = longer history = more context for Claude
- Reusing context (via caching) saves tokens and money

---

## Tokens on the Dashboard

### KPI Card: "Tokens Used"

Shows your total token consumption across all sessions.

**Breakdown:**
- **Purple:** Input tokens (your prompts)
- **Green:** Output tokens (Claude's responses)

**Interpretation:**
- High input tokens → You're sending long prompts or lots of files
- High output tokens → Claude is generating long responses
- Balanced → Healthy conversation style

### Token Trend Chart

Shows input (purple) and output (green) over time.

**Pattern analysis:**
- **Spikes:** Days when you used many tokens (complex problems, long sessions)
- **Trends:** Are you using more or fewer tokens over time?
- **Ratio:** Do output tokens match input, or is Claude generating much more?

**Metrics below the chart:**
- **Output Ratio:** Output tokens / (input + output). Higher = more response content.
  - Example: 60% output ratio means Claude is generating 60% of the tokens
- **Cache Hit Rate:** Percentage of tokens served from cache

---

## Cache Efficiency

### What Is Prompt Caching?

When you reuse the same context (like a large file, code repository, or system prompt), Claude caches it. Cached tokens are:
- Processed once
- Reused multiple times
- Cost less than new tokens

**Example:** You paste a 1000-token file in your first prompt. It gets cached. Your next 5 prompts reuse the cached context. That file isn't reprocessed; you just pay once.

### Cache Hit Rate

**Definition:** Percentage of tokens served from cache vs newly processed.

**Formula:** Cached tokens / (cached + new) × 100

**Example:**
- You send 100 tokens of new prompt
- 900 tokens of cached context are reused
- Total: 1000 tokens processed
- Cache hit rate: 900 / (100 + 900) × 100 = 90%

**See it on the dashboard:** Look at "Cache Hit Rate" metric on the Token Trend chart.

### Why Cache Hit Rate Matters

**Higher cache hit rate = more efficient usage:**
- You save tokens by reusing context
- Claude responds faster (cached tokens processed faster)
- If you're on a metered plan, you save money

**Lower cache hit rate = more new prompts without reused context:**
- Every prompt has new information
- Claude processes everything fresh
- Uses more tokens overall

---

## How to Optimize Token Usage

### 1. Reuse Context

If you're working on the same project repeatedly, reuse your context:

**❌ Bad:** Paste the entire codebase in every prompt
**✅ Good:** Paste once, then reference files by path in follow-up prompts

**How it works:**
1. First prompt: Paste your code (gets cached)
2. Second prompt: "Using the code from before, how do I..."
3. The cached code is reused, you only pay for new tokens

### 2. Be Specific, Not Verbose

**❌ Bad prompt (lots of input tokens):**
```
"Please look at my entire project and tell me everything that's wrong with it and how to fix it and also how to optimize it and also security issues and also performance issues"
```

**✅ Good prompt (fewer input tokens):**
```
"In file.go, the function at line 47 has a race condition. Help me fix it."
```

Less input = fewer tokens spent. More focused = better output.

### 3. Organize Conversations

**❌ Bad:** One massive session with everything
**✅ Good:** Separate sessions by project/problem

Each session has its own context window. Organizing saves tokens by keeping only relevant history.

### 4. Monitor Your Cache Hit Rate

Check the Token Trend chart weekly:
- Is your cache hit rate improving? (Good — reusing context)
- Trending down? (You might be starting fresh conversations too often)

### 5. Use Session Folders

Claude Code stores sessions in project-based folders automatically. Keep projects organized so you can easily reuse context:

```
~/.claude/projects/
├── my-web-app/
│   ├── session-2026-04-12-abc.jsonl
│   ├── session-2026-04-13-def.jsonl
│   └── session-2026-04-14-ghi.jsonl
├── data-pipeline/
│   ├── session-2026-04-14-jkl.jsonl
│   └── ...
```

When you switch back to `my-web-app`, the context from previous sessions is still available to reference.

---

## Reading the 7-Day Heatmap

The heatmap below the Token Trend chart shows daily input/output breakdown:

**Top half (Input):** Your prompt tokens by day
**Bottom half (Output):** Claude's response tokens by day

**Colors:** Darker = more tokens, lighter = fewer tokens

**Interpretation:**
- Monday = dark input, light output → You asked complex questions, Claude gave short answers
- Tuesday = light input, dark output → You asked simple questions, Claude elaborated
- Wednesday = dark both → Heavy usage day

---

## FAQ

### "Why do I have so many output tokens?"

Reasons:
1. You're asking Claude to generate long responses (code, documentation, analysis)
2. You're reusing context, so new requests are cheap but responses are detailed
3. You have many sessions with complex problems (which require detailed answers)

This is normal.

### "How do I reduce token usage?"

- Be specific in your prompts (fewer input tokens)
- Reuse context when possible (use cache more)
- Organize sessions by project (avoid starting fresh)
- Ask focused questions (not "review everything")

### "Does cache hit rate mean I'm saving money?"

If you're on a Claude API plan (pay-per-token), yes — cached tokens cost less.

If you're on a subscription plan, no — you pay a fixed amount regardless of cache hits.

But cache hits do process faster, so they're still beneficial.

### "Can I see my cache hit rate per session?"

Currently, only on the dashboard as an aggregate metric. Per-session details are coming soon.

---

## Next Steps

- **Review your metrics:** Check the Token Trend chart on the Dashboard
- **Identify your usage pattern:** Are you input-heavy or output-heavy?
- **Optimize:** Use the tips above to reduce tokens or improve cache hits
- **Track weekly:** Monitor trends to see if you're improving efficiency
