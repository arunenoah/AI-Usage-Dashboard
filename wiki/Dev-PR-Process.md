# PR Process

How to submit contributions and get your code reviewed.

## Before You Start

1. **Check [Issues](https://github.com/arunenoah/AI-Usage-Dashboard/issues)** — Is someone already working on this?
2. **Start a Discussion** — For major features, [open a discussion](https://github.com/arunenoah/AI-Usage-Dashboard/discussions) first
3. **Claim the issue** — Comment "I'd like to work on this" to let others know

## Development Workflow

### 1. Fork & Clone

```bash
# Fork the repo on GitHub (button in top-right)
# Clone your fork
git clone https://github.com/YOUR_USERNAME/AI-Usage-Dashboard.git
cd AI-Usage-Dashboard

# Add upstream remote
git remote add upstream https://github.com/arunenoah/AI-Usage-Dashboard.git
```

### 2. Create Feature Branch

Branch names:
- Feature: `feature/adapter-cursor`
- Bug fix: `fix/memory-leak-upsert`
- Docs: `docs/api-reference`

```bash
# Update main
git fetch upstream
git rebase upstream/main

# Create branch
git checkout -b feature/adapter-cursor
```

### 3. Make Changes

Follow [Code Style & Standards](Dev-Code-Style).

**Commit often, write clear messages:**

```bash
# Good commit messages
git commit -m "feat: add Cursor adapter with full session parsing"
git commit -m "fix: race condition in store.Upsert() with concurrent reads"
git commit -m "test: add coverage for PeakHour metric computation"
git commit -m "docs: update README with adapter architecture"

# Bad commit messages
git commit -m "fix stuff"
git commit -m "WIP"
git commit -m "asdf"
```

**Message format:**
```
<type>: <short description>

<longer explanation if needed>
<explain why, not just what>

Fixes #123
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `test:` Tests only
- `docs:` Documentation
- `refactor:` Code cleanup (no behavior change)
- `perf:` Performance improvement
- `ci:` CI/CD changes

### 4. Test Locally

```bash
# Run backend tests
go test -cover ./...

# Run frontend tests
cd web && npm test

# Build and test manually
make build
./ai-sessions
# Visit http://localhost:8765
# Verify your changes work
```

### 5. Keep Up with Main

```bash
# If main has changed while you worked
git fetch upstream
git rebase upstream/main

# If there are conflicts
# 1. Resolve in editor
# 2. Mark as resolved
git add .
git rebase --continue
```

## Submitting a PR

### 1. Push Your Branch

```bash
# Push to your fork
git push origin feature/adapter-cursor

# First time pushing this branch?
git push -u origin feature/adapter-cursor
```

### 2. Open Pull Request on GitHub

**Title:**
```
Add Cursor adapter with session parsing

or

Fix: resolve race condition in Store.Upsert()
```

**Description template:**

```markdown
## What does this PR do?
Brief summary of changes.

## Why?
Why is this change needed? What problem does it solve?

## How?
How did you approach this? Any important implementation details?

## Testing
How did you test this? Include steps to reproduce.
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] No breaking changes

## Related Issues
Fixes #123
Related to #456

## Checklist
- [ ] Code follows style guidelines
- [ ] No new warnings in build
- [ ] Tests pass locally
- [ ] Documentation updated (if needed)
```

### 3. Address Review Feedback

The maintainer will review your code. They might ask for changes.

**When feedback arrives:**
```bash
# Make the requested changes
# Commit with a clear message
git commit -m "refactor: simplify error handling per review feedback"

# Push again (no need to force)
git push origin feature/adapter-cursor

# The PR updates automatically
```

**Discussion in comments:**
- Be respectful and open to feedback
- Ask questions if something is unclear
- Suggest alternatives if you disagree (explain why)

### 4. Merge

Once approved:
```bash
# Maintainer clicks "Merge" on GitHub
# Your branch is automatically deleted
# Celebrate! 🎉
```

## Common Scenarios

### Scenario 1: Multiple commits before merging

```bash
# Your history
commit 3: fix typo
commit 2: refactor logic
commit 1: add feature

# Squash before PR (optional, maintainer can do it)
git rebase -i HEAD~3
# Mark commits 2 and 3 as "squash"
# Result: 1 clean commit
```

### Scenario 2: Need to update after PR open

```bash
# Make changes
git add .
git commit -m "fix: address review feedback"

# Push
git push origin feature/adapter-cursor

# GitHub PR automatically updates with new commit
```

### Scenario 3: PR got conflicted

```bash
# If main changed and conflicts exist
git fetch upstream
git rebase upstream/main

# Resolve conflicts in editor
# Mark resolved
git add .
git rebase --continue

# Force push to update PR
git push origin feature/adapter-cursor --force
```

## PR Review Checklist

What reviewers will look for:

### Code Quality
- [ ] Follows code style guide
- [ ] No obvious bugs or edge cases missed
- [ ] Comments where needed
- [ ] Error handling is robust
- [ ] No code duplication

### Testing
- [ ] Tests cover new code
- [ ] Tests pass locally
- [ ] Coverage hasn't decreased
- [ ] Edge cases are tested

### Performance
- [ ] No obvious performance regressions
- [ ] Memory leaks considered
- [ ] Database queries optimized (if applicable)

### Documentation
- [ ] README updated (if feature is user-facing)
- [ ] Code comments explain non-obvious logic
- [ ] Function docstrings present

### Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] No SQL injection risks (N/A for this project)
- [ ] Error messages don't leak sensitive info

## Example: Full PR Workflow

```bash
# 1. Create branch
git checkout -b feature/peak-hour-metric

# 2. Make changes
# Edit internal/store/store.go
# Edit internal/models/models.go
# Edit web/src/pages/Dashboard.jsx

# 3. Test locally
go test -cover ./...
cd web && npm test
make build
./ai-sessions  # Manual testing

# 4. Commit
git add internal/
git commit -m "feat: add peak hour metric with hourly breakdown"
git add web/
git commit -m "feat: display peak hour in dashboard KPI card"

# 5. Keep up with main
git fetch upstream
git rebase upstream/main

# 6. Push
git push -u origin feature/peak-hour-metric

# 7. Open PR on GitHub
# - Title: "Add peak hour metric and UI widget"
# - Description: [from template]

# 8. Wait for review
# - Maintainer reviews
# - Leaves comments or approves

# 9. Address feedback (if any)
# - Make changes
git add .
git commit -m "refactor: simplify hour aggregation logic"
git push origin feature/peak-hour-metric

# 10. Merge
# - Maintainer clicks "Merge"
# - Your branch deleted
# - Celebrate!
```

## Tips for Successful PRs

### 1. Start Small
Easier to review, faster to merge.
```bash
# Good: Single focused feature
feature/add-peak-hour-metric

# Bad: Multiple unrelated changes
feature/refactor-entire-store-and-add-ui
```

### 2. Write Clear Commit Messages
Future maintainers (including you!) will thank you.

### 3. Test Before Pushing
Don't let CI catch obvious mistakes.

### 4. Respond to Feedback
Show that you value the review and are willing to improve.

### 5. Keep PRs Fresh
If it sits for months without activity, maintainer might close it to keep the queue clean. You can re-open anytime.

## After Your PR Merges

### 1. Update Your Local Main
```bash
git fetch upstream
git checkout main
git rebase upstream/main
```

### 2. Delete Your Branch
```bash
# Local
git branch -d feature/peak-hour-metric

# On GitHub (usually auto-deleted)
git push origin --delete feature/peak-hour-metric
```

### 3. Share Your Contribution
- Link to PR in your portfolio
- Mention in blog post or Twitter
- Help others with similar PRs

## Troubleshooting

| Problem | Solution |
|---------|----------|
| CI tests failing | `git push origin --force` usually not needed; just fix and commit again |
| Merge conflicts | `git rebase upstream/main`, resolve, `git rebase --continue` |
| Forgot to update branch | `git rebase upstream/main` before pushing |
| Wrong branch name | Create new branch, cherry-pick commits, delete old branch |
| Accidental commit to main | Create new branch from your commits, reset main to upstream |

## Getting Help

- **Confused about workflow?** [GitHub's flow guide](https://guides.github.com/introduction/flow/)
- **Git commands?** [Git docs](https://git-scm.com/doc) or ask in PR comments
- **Code questions?** Comment on PR with your question
- **Feature ideas?** [Start a discussion](https://github.com/arunenoah/AI-Usage-Dashboard/discussions)

## Next Steps

- **Code style:** [Code Style & Standards](Dev-Code-Style)
- **Testing:** [Testing Requirements](Dev-Testing-Requirements)
- **Building:** [Building & Deployment](Dev-Building-Deployment)
