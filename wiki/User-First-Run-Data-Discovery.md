# First Run & Data Discovery

Get your sessions loading in the dashboard.

## Where Does It Look for Sessions?

The dashboard scans `~/.claude/projects/` for session files created by Claude Code.

### Check your data directory

```bash
ls -la ~/.claude/projects/
```

You should see folders like:
```
project-name-1/
project-name-2/
...
```

Inside each project folder, look for `session-*.jsonl` files:

```bash
ls -la ~/.claude/projects/project-name-1/
```

You should see:
```
session-20260101-xyz.jsonl
session-20260102-abc.jsonl
...
```

---

## Why Aren't My Sessions Showing Up?

### Problem 1: Claude Code Hasn't Created Sessions Yet

If `~/.claude/projects/` is empty, you haven't used Claude Code yet.

**Solution:** Use Claude Code to create at least one session:
1. Open Claude Code
2. Ask it a question or run a command
3. Wait for it to complete
4. Sessions are saved automatically

Then reload the dashboard.

### Problem 2: Data Directory Doesn't Exist

If `~/.claude` doesn't exist, Claude Code hasn't been set up.

**Solution:** Install Claude Code first:
1. Download from [claude.com/claude-code](https://claude.com/claude-code)
2. Run through setup
3. Use it to create a session
4. Then run the dashboard

### Problem 3: Wrong Claude Version

Very old Claude versions may not create `.jsonl` files in `~/.claude/projects/`.

**Solution:** Update Claude Code to the latest version.

### Problem 4: File Permissions

The dashboard can't read your session files.

**Solution:** Check file permissions:

```bash
ls -la ~/.claude/projects/*/session-*.jsonl
```

Files should be readable by your user. If not:

```bash
chmod -R u+r ~/.claude/projects/
```

### Problem 5: Slow to Load

The dashboard scans and parses all sessions at startup. With many sessions, this can take a few seconds.

**Solution:** Give it 5-10 seconds after starting. Check the terminal output to see progress:

```
Loading sessions...
Parsed 150 sessions in 2.3s
```

---

## Verify Sessions Are Loading

### 1. Check the terminal output

When you run `./ai-sessions`, you should see:

```
Server running on http://localhost:8765
Loading sessions...
Parsed 42 sessions in 1.2s
Watching for session updates...
```

The number of sessions should be > 0.

### 2. Check the dashboard KPI cards

Visit `http://localhost:8765` and look for:
- **Sessions:** Should show your session count (e.g., "42")
- **Tokens Used:** Should show total tokens
- **Projects:** Should show your project names

If all are 0, see "Why Aren't My Sessions Showing Up?" above.

### 3. Check the Session Explorer

Scroll to the Session Explorer table. You should see rows like:

| Session ID | Project | Tokens | Date |
|-----------|---------|--------|------|
| session-2... | my-app | 15.2K | 2026-04-12 |
| session-1... | my-app | 8.5K | 2026-04-11 |

If the table is empty, you have 0 parseable sessions.

---

## Using Adapters

The dashboard can pull sessions from multiple sources:

- **Claude Code** (default): `~/.claude/projects/`
- **GitHub Copilot** (if enabled): Copilot session logs
- **Windsurf** (coming soon)
- **Cursor** (coming soon)

By default, only Claude Code is enabled. To enable other adapters:

1. Go to the **Settings** page in the dashboard
2. Toggle adapters on/off
3. Restart the dashboard

See [Glossary](Glossary#adapter) for more on adapters.

---

## Still Stuck?

See [Troubleshooting & FAQs](User-Troubleshooting-FAQs) for more help.

Or [open an issue](https://github.com/arunenoah/AI-Usage-Dashboard/issues) with:
- Your OS and Claude Code version
- Output of `ls -la ~/.claude/projects/`
- Terminal output when running the dashboard
