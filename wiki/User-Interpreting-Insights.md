# Interpreting Insights

Understand your PromptScore tier, dimensions, and path to improvement.

## Your Tier

Your tier is a **skill level classification** based on your average CARE score across all conversations.

### Tier Levels

- **Beginner** (avg score 1-3)
  - Just starting with Claude
  - Prompts often lack context or clear direction
  - Focus: Add more specific details and clear requests

- **Intermediate** (avg score 4-6)
  - Consistent effort to structure prompts
  - Missing some rules or examples
  - Focus: Strengthen constraints and show examples

- **Advanced** (avg score 7-8)
  - Well-structured prompts, mostly complete
  - Minor gaps in edge cases or acceptance criteria
  - Focus: Fine-tune for full coverage

- **Expert** (avg score 9-10)
  - Comprehensive, actionable prompts consistently
  - Cover all CARE dimensions fully
  - Focus: Maintain high standards

### Find Your Tier

Open the Dashboard → PromptScore widget (top right) → Look for your tier badge.

---

## Per-Dimension Insights

Below your tier, the PromptScore widget shows a breakdown:

```
📝 Context: Weak (0.8/2)
❓ Ask: Good (2.5/3)
📋 Rules: Needs Work (1.1/2)
📚 Examples: Missing (0.2/2)
```

Each dimension shows:
- **Status:** Weak, Needs Work, Good
- **Score:** Your average for that dimension (e.g., 0.8 out of 2)

### Understanding Dimensions

- **Context is weak?** You often forget to mention file paths, your role, or background info. Add more setup.
- **Ask is good?** Your action verbs and steps are clear. Keep it up!
- **Rules need work?** You're not specifying constraints, frameworks, or what to avoid. Be explicit about boundaries.
- **Examples missing?** You rarely show code snippets or reference existing code. Paste examples more often.

---

## Path to Next Tier

The "Path to Next Tier" section shows **exactly what to improve** to reach the next tier.

**Example:**
```
Path to Expert:
- Add more examples in your prompts (examples →)
- Specify rules and constraints better (examples →)
```

### How to Read It

Each item lists one missing dimension. Click `examples →` to see:
- A low-scoring prompt you actually wrote
- A better version with that dimension strengthened
- Why the improved version scores higher

### Applying It

1. **Read the bad/good example pair**
2. **Understand the pattern** (e.g., "I need to add code examples")
3. **Apply it to your next prompt** (paste a code sample when relevant)
4. **Check back in a week** to see if your score improved

---

## Peer Benchmarks

The PromptScore widget may show how your score compares to other users:

```
Your Average Score: 6.2
Community Average: 5.8
↑ You're above average!
```

**Important:** This is **not** a competition. It's just context:
- Your scores are private
- Benchmarks help you see if you're trending up or down
- Everyone improves at their own pace

### Using Benchmarks

- **If you're above average:** Keep pushing toward Expert. See what the next tier requires.
- **If you're below average:** Don't worry. Follow the Path to Next Tier and improve gradually.
- **If you're stable:** Check if you're improving week-over-week, even if benchmarks don't change.

---

## Tracking Progress

### Weekly Review

Every Sunday (or your preferred day):
1. Open the Dashboard
2. Check your tier and average score
3. Compare to last week: Did it go up?
4. If up: Celebrate! You're improving.
5. If down: No problem. Check Path to Next Tier and try again.

### Long-Term Trends

Over weeks/months:
- **Score trending up?** You're internalizing the CARE framework. Keep going!
- **Score stable?** You've plateaued. Look for patterns in low-scoring prompts and fix them.
- **Score down?** You might be experimenting with new problem types (higher difficulty). That's normal.

### Keeping a Journal (Optional)

Some users track their improvements:

```
Week 1: Beginner (avg 2.1)
- Focused on adding context to every prompt
- By week 2: Intermediate (avg 4.5)

Week 5: Advanced (avg 7.2)
- Now focusing on including examples
- Next goal: Reach Expert by month-end
```

Tracking helps you see progress and stay motivated.

---

## Common Insights

### "My score jumped up!"

Possible reasons:
- You started being more specific
- You're using numbered steps (Ask dimension)
- You started pasting code examples (Examples dimension)

Keep it up!

### "My score went down."

Don't worry. Reasons:
- You're tackling harder problems (edge cases are more complex)
- You started new types of work (different problem domain)
- Random fluctuation (you had a bad day)

Check the Path to Next Tier and refocus on weak dimensions.

### "I'm stuck at Intermediate."

Look at your dimensions:
- Which is weakest (lowest score)?
- Is it Context, Ask, Rules, or Examples?
- Focus on strengthening just that one for a week
- Tier improvement follows naturally

### "I don't see my benchmarks."

Benchmarks are opt-in and anonymized. If you don't see them:
- You might be an early adopter
- Benchmarks populate after many users' data
- Check back later

---

## Using Insights to Improve

### Step 1: Find Your Weakest Dimension

Open PromptScore widget and look for the **lowest score** (e.g., Examples: 0.2/2).

### Step 2: Click Its "examples →" Link

This shows you real bad/good prompt pairs for that dimension.

### Step 3: Understand the Pattern

Ask: "What did they add to fix it?" (e.g., code snippets, links, references)

### Step 4: Apply to Your Next Prompt

Before sending your next prompt, actively add that element (if applicable).

### Step 5: Track the Result

After a few prompts, check if that dimension score improved.

### Step 6: Move to Next Dimension

Once one dimension is stronger, move to the next weak one.

---

## FAQ

### "Can my tier go down?"

Yes, but it's rare. It would require a significant drop in average score (avg 8 → avg 5). Usually it's stable or improving.

### "How often does my tier update?"

After every new conversation pair. But you'll see significant changes (e.g., Beginner → Intermediate) over weeks, not days.

### "Is there a tier above Expert?"

No. Expert is the highest. Once you reach it, focus on consistency: keep scoring 9-10s.

### "I disagree with my insights. Can I report it?"

Yes. Open an issue on GitHub with examples. Your feedback helps improve the scoring system.

---

## Next Steps

- **Check your tier:** Open the PromptScore widget on the Dashboard
- **Find your path:** Read the "Path to Next Tier" recommendations
- **Learn from examples:** Click "examples →" for weak dimensions
- **Improve:** Apply what you learned to your next prompts
- **Track weekly:** Monitor your progress week-over-week
