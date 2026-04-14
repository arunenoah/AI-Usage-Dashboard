# CARE Scoring Explained

Understand how the dashboard scores your prompts 1-10 and what you can do to improve.

## What Is CARE Scoring?

CARE is a framework for evaluating prompt quality. Every conversation (user message → Claude response) gets a score from 1-10 based on how well your prompt was structured.

**Score breakdown:**
- **1-4 Weak:** Missing most CARE elements, vague or incomplete instructions
- **5-6 Needs Work:** Has some structure, but critical details are missing
- **7-8 Decent:** Well-structured, mostly complete, minor gaps
- **9-10 Good:** Comprehensive, actionable, specific, well-scoped

The scoring is **strict by design** — only truly well-structured prompts earn 9-10. This is to challenge you to improve.

---

## The Four Dimensions

### [C] Context (0-2 points)

**What it measures:** Does your prompt set up the context?

**Good context includes:**
- File paths or function names you're working with
- Your role or persona (e.g., "You're a DevOps engineer")
- Background information Claude needs
- Current state or constraints

**Example prompts:**

❌ **Weak (0 pts):** "How do I debug this?"
- No context. Claude doesn't know what you're debugging.

✅ **Better (2 pts):** "I'm debugging a race condition in `src/store.go` line 47. The mutex isn't preventing concurrent writes. I'm a Go beginner. Help me understand the issue."
- File path, function, role, specific problem.

**How to improve:**
- Always mention file names or paths
- Tell Claude your experience level or role
- Explain what you've tried and why it failed

---

### [A] Ask (0-3 points)

**What it measures:** Is your request clear and detailed?

**Good asks include:**
- Clear action verb (help, fix, explain, refactor, add, etc.)
- Detailed instructions, not just "do it"
- Multi-step requests should be structured (numbered or bulleted)
- Specific outcomes or acceptance criteria

**Example prompts:**

❌ **Weak (0 pts):** "Write a function."
- No action detail. What function? What should it do?

✅ **Better (3 pts):** "Write a function called `validateEmail()` that: 1) Accepts a string, 2) Returns true if valid email format, false otherwise, 3) Handles edge cases (null, empty string, spaces), 4) Provide unit tests in Jest."
- Clear action, detailed steps, acceptance criteria, test requirement.

**How to improve:**
- Start with a strong verb: "Write", "Fix", "Explain", "Refactor"
- Use numbered or bulleted steps for complex requests
- Specify what "done" looks like

---

### [R] Rules (0-2 points)

**What it measures:** Do you specify constraints and boundaries?

**Good rules include:**
- Constraints (performance, size, style, language, framework)
- Boundaries (what NOT to do, what to avoid)
- Expected behavior or edge cases
- Acceptance criteria (success looks like...)

**Example prompts:**

❌ **Weak (0 pts):** "Optimize this code."
- No rules. Optimize for speed? Memory? Readability?

✅ **Better (2 pts):** "Optimize this code for: 1) Readability (no over-engineering), 2) Performance (< 100ms runtime), 3) Style (follow our ESLint config), 4) Constraints (must use Tailwind, no external libs)."
- Clear constraints and boundaries.

**How to improve:**
- Say what matters: speed, readability, safety, style, compatibility
- Specify frameworks, languages, or tools you're using
- Mention things to avoid (e.g., "don't use npm packages")

---

### [E] Examples (0-2 points)

**What it measures:** Do you show what good output looks like?

**Good examples include:**
- Code snippets showing desired format or style
- Before/after patterns
- Links to reference code or documentation
- Sample output or desired structure

**Example prompts:**

❌ **Weak (0 pts):** "Write a React component."
- No example. What should it look like? What props?

✅ **Better (2 pts):** "Write a React component. Reference this existing component for style: [file.tsx]. Desired props: `{ label, onClick, disabled }`. Return type should be JSX.Element. See this example for the layout I want: [screenshot or code]."
- References existing code, specifies props, shows desired layout.

**How to improve:**
- Show a code snippet of what you want
- Link to existing code as a reference
- Describe the desired output format
- Use before/after examples

---

## How Scoring Works

The dashboard scores every conversation pair (your message + Claude's response) by analyzing your prompt for CARE dimensions.

**Calculation:**
```
Total Score = Context (0-2) + Ask (0-3) + Rules (0-2) + Examples (0-2)
Score Range: 1-10
```

**Scoring is server-side:** Your prompts are analyzed by Claude's API. Scores are computed per conversation and cached.

**Scoring is strict:** To reach "Good" (9-10), you need near-perfect coverage of all four dimensions. This is intentional — we want to challenge you to improve.

---

## Real Examples from Your Sessions

The PromptScore widget shows real examples from your own conversations:

**Bad prompt (you typed this):**
```
"How do I cache API responses?"
```
Score: 2 (Weak)

**What's missing:**
- [C] No context about your stack, current code, or constraints
- [A] Too vague — caching where? How? What tech?
- [R] No rules or constraints
- [E] No example of what success looks like

**Better version (what you could have typed):**
```
"I have a React component that fetches user data. The API endpoint is `/api/users/:id`. I want to cache responses for 5 minutes to avoid duplicate requests. I'm using React Query. Show me how to: 1) Set up query caching, 2) Test that it works, 3) Handle cache invalidation when data changes. Use a code example."
```
Score: 8 (Decent)

**What improved:**
- [C] Stack (React Query), endpoint, purpose
- [A] Specific steps (setup, testing, invalidation) + action (show, use example)
- [R] Constraint (5-minute TTL, handle invalidation)
- [E] Code example requested

---

## Your Tier

Based on your **average CARE score**, you're classified into a tier:

- **Beginner** (avg 1-3): Focus on adding context and clear action verbs
- **Intermediate** (avg 4-6): Strengthen your rules and examples
- **Advanced** (avg 7-8): Fine-tune for edge cases and acceptance criteria
- **Expert** (avg 9-10): Consistently structured, comprehensive prompts

**See your tier:** Look at the PromptScore widget on the Dashboard.

**Path to next tier:** The widget shows exactly what to improve (e.g., "Add more examples, specify constraints").

---

## Improving Your Score

### Quick Wins

1. **Add context:** Always mention file paths, project, role, or problem statement
2. **Use action verbs:** "Write", "Fix", "Explain", "Refactor" (not "do it")
3. **Add constraints:** Mention style, performance, tools, or what to avoid
4. **Show examples:** Paste a code snippet or link to reference code

### Long-Term Habits

- **Review your low-scoring prompts:** Session Explorer shows your score for each conversation. Click and read why it was low.
- **Use the examples panel:** See real bad/good versions from your own usage
- **Apply the framework:** Before sending a prompt, check: Context? Ask? Rules? Examples?
- **Iterate:** Try scoring 1-2 points higher each week

---

## FAQ

### "Why is my score so low? I feel like my prompts are clear."

CARE scoring is **intentionally strict**. A score of 5-6 is normal for most users. 9-10 is rare. This is by design — we want to push you to be even more specific.

### "Does score affect Claude's response quality?"

No. The score is feedback on your prompt structure, not Claude's output. A low-scoring prompt can still get a great response. But **well-structured prompts** tend to get better results.

### "Can I disagree with a score?"

Yes. Open an issue on GitHub with your prompt and score. We use your feedback to improve scoring accuracy.

### "I used a good prompt but got a low score. Why?"

Some reasons:
- You used abbreviations or implied context Claude might not know
- The prompt was short and terse (efficiency vs clarity trade-off)
- Scoring is based on **visible structure**, not invisible intent

### "How often do I get scored?"

Every conversation pair you have with Claude gets scored. New scores appear in the dashboard in real-time.

---

## Next Steps

- **See your score:** Open the PromptScore widget on the Dashboard
- **Learn from examples:** Click "examples →" to see real bad/good prompts
- **Improve:** Use the "Path to Next Tier" guide to know what to focus on
- **Track progress:** Check your tier weekly to see if you're improving
