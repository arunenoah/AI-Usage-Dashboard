# Tips & Best Practices

How to use the dashboard effectively and write better prompts.

## Writing Better Prompts Using CARE

### Before You Send: The CARE Checklist

Before hitting "send" on any prompt, ask yourself:

- **[C] Context:** Have I set up file names, roles, or background info?
- **[A] Ask:** Is my action clear (write, fix, explain)? Are steps numbered if multi-step?
- **[R] Rules:** Did I specify constraints (framework, style, tools, what to avoid)?
- **[E] Examples:** Did I show code, links, or desired format?

If you answer "no" to any, add it. Your scores will improve.

### Writing for Your Audience

**If you're the only one reading:**
- Be casual, abbreviate
- CARE score might be low, but you understand your intent
- That's okay! Focus on high-value prompts.

**If you're asking Claude to do something complex:**
- Always use CARE
- More detail = better response quality
- Your score + response quality = better overall outcome

### Common Prompt Patterns

#### Pattern 1: Debugging

**Bad:**
```
Why is this broken?
```

**Good:**
```
File: src/store.go, function LoadData() at line 47.
Problem: Concurrent writes corrupt the data. 
I'm a Go beginner. 

Explain:
1. Why the current mutex approach fails
2. How to fix it correctly
3. Provide a test that catches this bug

Use code examples.
```

#### Pattern 2: Code Generation

**Bad:**
```
Write a function to sort users.
```

**Good:**
```
Write a function `sortUsers()` that:
1. Accepts: array of User objects (see User type in models.ts)
2. Sorts by: name ascending, then age descending
3. Returns: new sorted array (don't mutate input)
4. Handles: null/undefined gracefully

Constraints:
- TypeScript
- Jest unit tests (normal case, empty, nulls, duplicates)
- Reference style: See utils/sort.ts

Provide: Function + tests.
```

#### Pattern 3: Refactoring

**Bad:**
```
Clean up this code.
```

**Good:**
```
File: api/handlers.go, function getUsersHandler() at lines 42-89.
Current issue: Function is 50 lines, does too much (auth, validation, fetching, response shaping).

Refactor to:
1. Split into smaller functions (one responsibility each)
2. Keep the HTTP handler thin (just routing + response)
3. Move business logic to service layer
4. Keep current functionality (no behavior changes)

Constraints: Follow repo's patterns (see existing auth_handler.go, user_service.go)

Provide: Refactored code with explanation of changes.
```

---

## Session Organization

### File Organization Tips

Keep your projects organized so you can reuse context:

**Good structure:**
```
~/.claude/projects/
├── payment-system/
│   ├── session-2026-04-10-auth.jsonl
│   ├── session-2026-04-11-checkout.jsonl
│   └── session-2026-04-12-stripe-integration.jsonl
├── data-pipeline/
│   ├── session-2026-04-12-etl.jsonl
│   └── session-2026-04-13-testing.jsonl
```

**Benefits:**
- Sessions grouped by project in the dashboard
- Easy to reuse context from previous sessions on the same project
- History is easy to follow

### Reusing Context Effectively

When working on the same project:

**Session 1:** Paste the entire codebase
```
"Here's my codebase: [entire repo]
Now help me with the auth system..."
```

**Session 2:** Reference the context from before
```
"Using the code from before, how do I add password reset?"
```

Claude will reuse the cached context. You save tokens and time.

**Tip:** This works great when sessions are in the same project folder.

---

## Using Insights to Improve

### Weekly Review Ritual

Every Sunday evening:

1. Open dashboard
2. Check your PromptScore tier
3. Note your average CARE score
4. Compare to last week: Up? Down? Stable?
5. If up: Celebrate! You're improving.
6. If down: Click Path to Next Tier and focus on weak dimensions

### Monthly Goals

**Month 1:** Reach Intermediate (avg 4+)
- Focus: Add context and clear action verbs to every prompt

**Month 2:** Reach Advanced (avg 7+)
- Focus: Specify rules and constraints

**Month 3:** Reach Expert (avg 9+)
- Focus: Always include examples; be comprehensive

### Tracking Your Progress

Optional: Keep a simple log:

```
Week 1: Beginner (avg 2.1) — Added context to every prompt
Week 2: Intermediate (avg 4.5) — Started using numbered steps
Week 3: Intermediate (avg 5.2) — Learning to add examples
Week 4: Advanced (avg 7.1) — Now focusing on rules/constraints
```

Seeing progress motivates you to keep improving.

---

## Understanding the Metrics

### Output Ratio

**What it means:** How much of your conversation is Claude's output vs your input.

**High (>60%):** Claude is generating a lot. You're getting long responses.
**Low (<40%):** You're sending long prompts. Maybe too much context?

**Example:**
- You send: 500 tokens (prompt)
- Claude sends: 1500 tokens (response)
- Output Ratio: 1500 / (500 + 1500) = 75%

**Optimization:** Aim for 50-70% for a healthy balance.

### Cache Hit Rate

**What it means:** Percentage of tokens reused from cache.

**High (>50%):** You're reusing context well. Efficient!
**Low (<20%):** You're starting fresh a lot. Consider organizing by project.

**Improvement:** Focus on working within one project folder and reusing sessions.

### Tool Breadth

**What it means:** Variety of tools Claude used (file reads, bash, code execution, etc.).

**High:** Claude is multitasking (reading files, running code, etc.). Good for complex problems.
**Low:** Simple conversations. That's fine.

**Note:** Don't optimize for tool breadth. It's just informational.

---

## Common Gotchas

### "I see a spike in tokens. Why?"

Reasons:
1. **You asked for something complex:** Large codebase reviews, big refactors, extensive documentation
2. **Context was large:** You pasted a big file or project structure
3. **Claude gave a long response:** Complex problems need detailed explanations

None of these are bad. Just note them for understanding.

### "My cache hit rate dropped."

Possible reasons:
1. You started a new project (no cached context)
2. You're asking about different topics (can't reuse old context)
3. You cleared your session history

This is normal. Cache hit rate improves when you work on consistent projects.

### "I forgot to use CARE. How do I improve?"

No problem. Going forward:
1. Make CARE part of your habit
2. Before sending, scan your prompt mentally: C? A? R? E?
3. If any are missing, add them
4. Your next conversations will score higher

---

## Pro Tips

### 1. Use Tabs / Browsers for Multiple Projects

If you work on multiple projects simultaneously:
- Tab 1: Payment System project
- Tab 2: Data Pipeline project

Each tab keeps its own context separately. Switch between them when you need to refocus.

### 2. Save Good Prompts

If you write a really good prompt (scores 9-10), save it somewhere:
- Notes app
- Bookmark it in browser
- Email it to yourself

Reuse the structure for similar tasks.

### 3. Ask For Feedback

Occasionally, ask Claude directly:

```
"I'm trying to improve my prompting skills. Rate this prompt on the CARE framework. 
What am I doing well? What should I improve for next time?"
```

Claude will give you feedback. Combine it with your dashboard insights.

### 4. Review Bad Prompts Regularly

Once a week, look at a low-scoring prompt from your Session Explorer:
1. Click it to open details
2. Read what you asked for
3. See the CARE tips in the drawer
4. Ask yourself: "How would I rewrite this better?"
5. Write out the better version (you don't have to send it, just practice)

---

## FAQ

### "Is CARE the only way to write prompts?"

No. CARE is a *framework* to structure your thinking. Some people write great prompts without consciously using CARE. But if you find yourself stuck, CARE provides a checklist.

### "Do I have to score 9-10 to get good results?"

No. You can get excellent responses with 5-6 scores. CARE scoring reflects *structure*, not response quality. A well-structured prompt (8-10) often gets better results, but not always.

### "My teammate's score is higher. Does that make them better?"

Not necessarily. Their prompts are more *structured*, not necessarily better at solving problems. Structure helps, but other factors (problem difficulty, creativity, domain expertise) matter too.

### "Can I improve my score quickly?"

Yes, relatively quickly:
- Week 1: Focus on context (add file names, role) → +1-2 points
- Week 2: Focus on ask (use action verbs, numbered steps) → +1-2 points
- Week 3: Focus on rules (specify constraints) → +1-2 points

3 weeks → Beginner to Intermediate

### "I don't care about my score. Is the dashboard still useful?"

Absolutely. The metrics (tokens used, project activity, tool usage) are valuable regardless of your prompting style. Score is optional feedback; metrics are data.

---

## Next Steps

- **Review a low-scoring prompt:** Click one in Session Explorer, read the tips
- **Apply CARE to your next prompt:** Consciously add context, ask, rules, examples
- **Check your tier weekly:** See if you're improving
- **Share with colleagues:** Encourage them to use the dashboard too
