# Troubleshooting & FAQs

Common problems and solutions.

## Sessions Not Showing Up

**Problem:** Dashboard loads but no sessions appear.

**Diagnosis flowchart:**

1. **Are any files in `~/.claude/projects/`?**
   ```bash
   ls -la ~/.claude/projects/
   ```
   - **No files:** You haven't created Claude sessions yet. Use Claude Code first.
   - **Files exist:** Continue to step 2.

2. **Terminal output: How many sessions parsed?**
   ```
   Parsed 0 sessions in 0.2s
   ```
   - **0 sessions:** Files exist but can't be parsed. Check step 3.
   - **>0 sessions:** Files loaded. Check the dashboard UI. Continue to step 4 if still not showing.

3. **Can the dashboard read the files?**
   ```bash
   file ~/.claude/projects/*/session-*.jsonl
   ```
   Should show: `... ASCII text ...`
   - **Permission denied:** Run `chmod -R u+r ~/.claude/projects/`
   - **Files found:** Continue to step 4.

4. **Dashboard loads but no rows in Session Explorer table**
   - Wait 5-10 seconds (parsing can be slow with many sessions)
   - Refresh the browser (`Ctrl+R` or `Cmd+R`)
   - Clear browser cache and reload

**Solution:**

| Symptom | Fix |
|---------|-----|
| `~/.claude/projects/` is empty | Use Claude Code to create a session |
| Files exist, terminal says "Parsed 0" | Check file permissions: `chmod -R u+r ~/.claude/projects/` |
| Files parse, dashboard shows 0 Sessions KPI | Refresh browser, wait 5s, check network tab (DevTools) |
| Session Explorer table is empty | Check browser console (F12) for errors |

---

## Dashboard Is Slow or Unresponsive

**Problem:** Dashboard takes forever to load or freezes.

**Causes & fixes:**

1. **Too many sessions**
   - First load scans and parses all sessions
   - Large session count (1000+) can take 10-30s
   - **Fix:** Wait for initial load. Subsequent loads are fast (WebSocket updates).

2. **Browser cache / old assets**
   - **Fix:** Hard refresh your browser
     - **macOS:** Cmd+Shift+R
     - **Windows/Linux:** Ctrl+Shift+R
   - Or clear browser cache entirely

3. **Backend server crashed**
   - Check terminal where you ran `./ai-sessions`
   - Look for error messages
   - **Fix:** Restart the dashboard
     ```bash
     # Ctrl+C to stop
     # Then run again:
     ./ai-sessions
     ```

4. **WebSocket disconnected**
   - Open browser DevTools (F12) → Network tab → Filter for "WS"
   - Is there an active WebSocket connection to `/ws`?
   - **If no:** Refresh the browser. If still no, backend crashed (see #3).
   - **If yes:** Dashboard should be responsive. Report a bug if not.

5. **System resource limits**
   - If you have 1000+ sessions, the in-memory store uses ~500MB
   - **Fix:** Run on a machine with >2GB RAM, or contact for scale recommendations

---

## WebSocket Connection Drops

**Problem:** "Lost connection" banner appears, real-time updates stop.

**Diagnosis:**

1. Open DevTools (F12) → Console tab
2. Look for errors like:
   ```
   WebSocket is closed: code 1006
   ```

**Causes & fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `code 1006` (abnormal closure) | Backend crashed or restarted | Restart backend: `./ai-sessions` |
| `code 1000` (normal closure) | Intentional disconnect | Refresh browser |
| `CORS` error | Network/firewall blocking | Check network, firewall rules |
| No error, just silent drop | Idle timeout or network glitch | Browser auto-reconnects; if stuck, refresh |

**Quick fix for any WebSocket issue:**
```
1. Browser refresh (Cmd+R or Ctrl+R)
2. If still broken, restart backend (Ctrl+C, then ./ai-sessions)
3. If still broken, check firewall/network (try localhost:8765 in curl)
```

---

## CARE Scores Seem Wrong

**Problem:** "I know my prompt was good, but the score is low."

**Important:** CARE scoring is **intentionally strict**. A score of 5-6 is normal. 9-10 is rare.

**Why your score might be lower than expected:**

1. **Missing context:** You mentioned code but not file names
2. **Vague ask:** You said "fix" but not what "fixed" means
3. **No rules:** You didn't specify constraints or tools
4. **No examples:** You didn't show desired format or reference code

**How to verify:**

1. Click the low-scoring conversation in Session Explorer
2. Read your exact prompt and Claude's response
3. Check the prompt quality ring in the detail panel
4. See the tips tagged with `[C]`, `[A]`, `[R]`, `[E]`

**Example:**

Your prompt: "How do I debug this?"
- Missing `[C] Context` → What are you debugging?
- Missing `[A] Ask` → What outcome do you want?
- Missing `[R] Rules` → Constraints?
- Missing `[E] Examples` → Show code?

**Fix:** Next time, include all four dimensions. See [CARE Scoring Explained](User-CARE-Scoring-Explained).

**Disagree with scoring?** Open a GitHub issue with your prompt and score. We use feedback to improve.

---

## Can I Share This With My Team?

**Problem:** Dashboard is currently single-user. You want to share analytics with teammates.

**Workarounds:**

1. **Screenshots:** Take screenshots of KPI cards and charts. Share them in Slack/email.

2. **Shared machine:** Install on a shared laptop. Whoever uses it gets their sessions included.

3. **Docker (future):** We're planning Docker support. Track [GitHub issue](https://github.com/arunenoah/AI-Usage-Dashboard/issues) for updates.

**Current limitation:** The dashboard reads from `~/.claude/projects/`, which is per-user. Multi-user support would require:
- Centralized session storage
- User authentication
- Privacy controls

This is on the roadmap but not yet implemented.

---

## Error: "Go not found"

**Problem:** You get `go: command not found` when running `make build`.

**Fix:**
1. Install Go from [go.dev/dl](https://go.dev/dl)
2. Verify: `go version`
3. If still not found, add Go to your PATH:
   - **macOS:** Usually automatic. Try restarting terminal.
   - **Linux:** Add to `~/.bashrc` or `~/.zshrc`:
     ```bash
     export PATH=$PATH:/usr/local/go/bin
     ```
     Then `source ~/.bashrc`
   - **Windows:** Go installer should add to PATH. Restart terminal or computer.

---

## Error: "npm not found"

**Problem:** `npm install` fails because npm isn't available.

**Fix:**
1. Install Node.js from [nodejs.org](https://nodejs.org)
2. Verify: `npm -v`
3. If still not found, restart your terminal or computer (PATH update might need restart)

---

## Error: "Port 8765 is already in use"

**Problem:** Another process is using port 8765.

**Find what's using it:**
```bash
# macOS/Linux:
lsof -i :8765

# Windows (PowerShell):
netstat -ano | findstr :8765
```

**Fix:**

Option 1: Kill the other process (if you don't need it)
```bash
# macOS/Linux:
kill -9 <PID>

# Windows (as admin):
taskkill /PID <PID> /F
```

Option 2: Use a different port
```bash
PORT=9000 ./ai-sessions
```

Then visit `http://localhost:9000`

---

## Sessions Load But No CARE Scores

**Problem:** Sessions appear in the table, but the Score column is empty.

**Causes:**

1. **Backend Haiku API not responding:** Scores are computed by Claude Haiku in the background
   - **Fix:** Wait 30 seconds. Scores are cached after first computation.

2. **No internet connection:** Haiku API requires internet
   - **Fix:** Check your network connection

3. **Rate limited:** Too many score requests at once
   - **Fix:** Wait a few minutes. Requests are queued.

**Workaround:** Scores will populate as you use the dashboard. They compute in the background.

---

## Browser Shows "Cannot connect to localhost:8765"

**Problem:** Browser can't reach the dashboard.

**Diagnosis:**

1. **Is the backend running?**
   ```bash
   # In terminal, you should see:
   # Server running on http://localhost:8765
   # Watching for session updates...
   ```
   - **No?** Run `./ai-sessions` first
   - **Yes?** Continue to step 2

2. **Did you build the frontend?**
   ```bash
   # Make sure you ran:
   make build
   ```
   - **No?** Run `make build` first
   - **Yes?** Continue to step 3

3. **Try manually:**
   ```bash
   curl http://localhost:8765
   ```
   - **Connection refused?** Backend isn't running. Check step 1.
   - **200 OK?** Backend works. Browser issue. Try `Ctrl+Shift+R` to hard refresh.

---

## Development Mode (Frontend Dev Server)

If you're developing and running the frontend dev server separately:

```bash
# Terminal 1: Frontend dev server
cd web
npm run dev
# Runs on http://localhost:5173

# Terminal 2: Backend server
go run .
# Runs on http://localhost:8765
```

Visit `http://localhost:5173` (not 8765). Vite proxies `/api` and `/ws` to the backend.

---

## Still Stuck?

If none of the above helps:

1. **Check the terminal output** where the backend is running for error messages
2. **Check browser console** (F12 → Console tab) for JavaScript errors
3. **Open a GitHub issue** with:
   - Your OS and versions (`go version`, `node -v`)
   - Error messages from terminal and browser console
   - Output of `ls -la ~/.claude/projects/` (sanitize sensitive paths)
   - What you've tried already

---

## FAQ

### "Why is the dashboard local-only?"

It's designed for privacy. Your Claude sessions stay on your machine. No data is sent anywhere except to Haiku for scoring.

### "Can I contribute a fix?"

Yes! See [Contributing Guide](../Dev-PR-Process).

### "Will there be cloud version?"

It's a long-term consideration. For now, it's local-first by design.

---

## Next Steps

- **Report a bug:** [GitHub Issues](https://github.com/arunenoah/AI-Usage-Dashboard/issues)
- **Suggest a feature:** Open a GitHub issue with "Feature request:" prefix
- **Learn more:** [User Guides](User-Dashboard-Overview)
