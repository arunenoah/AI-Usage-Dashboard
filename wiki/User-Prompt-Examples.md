# Using Prompt Examples

Learn from your own real prompts with the Prompt Examples feature.

## What Are Prompt Examples?

When you look at the PromptScore widget on the Dashboard, you see a "Path to Next Tier" section. Each item has an `examples →` link.

Clicking that link opens a slide-over panel showing **real prompts from your own sessions**, side-by-side:
- **Left (Red):** A prompt from your history that scored low
- **Right (Green):** A better version of that prompt
- **Explanation:** Why the improved version scores higher

**Key point:** These are YOUR actual prompts, not generic examples. You're learning from your own usage patterns.

---

## How to Access Examples

### 1. Go to the Dashboard

Visit `http://localhost:8765`

### 2. Look for the PromptScore Widget

On the right side, you'll see a card titled "PromptScore" with your tier (Beginner, Intermediate, etc.).

### 3. Find "Path to Next Tier"

Scroll down in the PromptScore widget. You'll see a section like:

```
Path to Next Tier:
- ☐ Add more context (examples →)
- ☐ Specify constraints (examples →)
- ☐ Include code examples (examples →)
```

### 4. Click "examples →"

Click any `examples →` link. A panel slides in from the right showing real prompt pairs from your sessions.

---

## Reading the Examples Panel

### Left Column (Red / Bad Prompt)

The prompt you actually typed in a past session. Example:

```
How do I fix this bug?
```

**What's missing:** No context, no details, no direction for Claude.

### Right Column (Green / Better Version)

A rewritten version of your prompt that scores higher. Example:

```
I have a race condition in src/store.go line 47. 
When two goroutines write simultaneously, the data corrupts. 
I'm a Go beginner and don't fully understand mutexes. 

Please:
1. Explain why the mutex isn't working
2. Show me the correct way to use sync.Mutex
3. Provide a test case that catches this bug

Use a code example and explain each step.
```

**What improved:**
- [C] Context: file, line, problem, your level
- [A] Specific steps (numbered)
- [R] Constraint: test case requirement
- [E] Code example requested

### Explanation

A brief explanation of why the improved version is better. It will explain what CARE dimensions were added or strengthened.

---

## Learning from Examples

### 1. Read Both Versions

Carefully read both the red and green versions. Notice the differences:
- What details were added?
- What structure was added?
- What became more specific?

### 2. Compare to Your Writing

Ask yourself: "Do I write like the red or green version?"
- If red: You tend to write short, vague prompts. Add more details.
- If green: You're already structured. Check for small improvements.

### 3. Apply to Your Next Prompt

Before sending your next prompt, ask:
- Did I set context? (file, role, background)
- Did I ask clearly? (action verb, steps, outcome)
- Did I specify rules? (constraints, frameworks, what to avoid)
- Did I show examples? (code, links, desired format)

### 4. Review Regularly

Check examples weekly. Over time, you'll notice patterns in what you're doing wrong and can fix them proactively.

---

## Real Example Walkthrough

**Your bad prompt (Red):**
```
Write a sorting function
```
**Score:** 2 (Weak)

**Improved prompt (Green):**
```
Write a function called `sortUsers()` that:
1. Accepts an array of User objects (see attached type definition)
2. Sorts by name (ascending), then by age (descending)
3. Returns a new sorted array without mutating the input
4. Handles null/undefined values gracefully

Use TypeScript. Provide unit tests in Jest covering: normal case, empty array, nulls, duplicates.

Reference our existing sorting utility at `utils/sort.ts` for style.
```
**Score:** 9 (Good)

**What changed:**
- **[C] Context:** Function name, input/output types, reference style guide
- **[A] Ask:** Numbered steps, specific sorting behavior, test coverage
- **[R] Rules:** TypeScript, Jest, no mutation, graceful nulls
- **[E] Examples:** Reference style guide, specific test cases

---

## Tips

1. **Don't memorize the green version.** Understand the pattern (add context, be specific, show examples) and apply it differently each time.

2. **Share with team:** If you see a great green example, share it with colleagues. It helps everyone write better prompts.

3. **Track improvements:** Each week, see if your prompts are getting longer and more detailed. That's a sign of improvement.

4. **Use CARE as a checklist:** After writing a prompt, check: C? A? R? E? If you're missing any, add it.

---

## Not Seeing Examples?

If the examples panel is empty:
- You might have very few low-scoring prompts (great job!)
- Examples are generated from your actual session data
- Give it a few more sessions with varied prompt quality
- Check back tomorrow

---

## Next Steps

- **Check your tier:** Open the PromptScore widget
- **Review examples:** Click "examples →" for each missing dimension
- **Track progress:** See if your tier improves over time
- **Learn the framework:** [CARE Scoring Explained](User-CARE-Scoring-Explained)
