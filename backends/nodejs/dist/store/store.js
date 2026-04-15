"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
const claudecode_1 = require("../adapters/claudecode");
const copilot_1 = require("../adapters/copilot");
const opencode_1 = require("../adapters/opencode");
const windsurf_1 = require("../adapters/windsurf");
// Pricing constants — must match Go store.go
const PRICE_INPUT_PER_M = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;
const PRICE_CACHE_READ_PER_M = 0.30;
const PRICE_CACHE_WRITE_PER_M = 3.75;
const CONTEXT_WINDOW = 200000;
function tokenCost(u) {
    return (((u.input_tokens || 0) / 1e6) * PRICE_INPUT_PER_M +
        ((u.output_tokens || 0) / 1e6) * PRICE_OUTPUT_PER_M +
        ((u.cache_read_input_tokens || 0) / 1e6) * PRICE_CACHE_READ_PER_M +
        ((u.cache_creation_input_tokens || 0) / 1e6) * PRICE_CACHE_WRITE_PER_M);
}
// ── isSystemInjection — mirrors Go handlers.go ──────────────────────────────
function isSystemInjection(text) {
    if (text.length < 3)
        return true;
    const noiseExact = [
        '[Request interrupted by user for tool use]',
        '[Request interrupted by user]',
        '[Interrupted by user]',
    ];
    const trimmed = text.trim();
    if (noiseExact.includes(trimmed))
        return true;
    // Context compaction continuation injected by Claude Code
    if (trimmed.startsWith('This session is being continued from a previous conversation')) {
        return true;
    }
    // Very long markdown-formatted messages are usually skill context injections
    if (text.length > 1500 && (text.startsWith('#') || text.startsWith('You are'))) {
        return true;
    }
    const prefixes = [
        'Base directory for this skill:',
        '# Spec Compliance',
        '# Code Quality',
        '# Implementer',
        'You are implementing Task',
        'You are reviewing whether',
        'Task tool (general-purpose)',
        'Task tool (superpowers:',
        'Use this template when',
        '[INST]',
    ];
    if (prefixes.some(p => trimmed.startsWith(p)))
        return true;
    // XML-tagged local command outputs — may appear with a leading bullet (• ) or directly
    const xmlCommandTags = [
        '<command-message>',
        '<command-name>',
        '<local-command-caveat>',
        '<local-command-stdout>',
        '<local-command-',
    ];
    if (xmlCommandTags.some(tag => trimmed.includes(tag)))
        return true;
    return false;
}
// ── isSpecificPrompt — mirrors Go handlers.go ────────────────────────────────
function isSpecificPrompt(text) {
    if (!text)
        return false;
    const lower = text.toLowerCase();
    const exts = ['.go', '.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.php', '.rs', '.java', '.cs', '.cpp', '.c', '.sh', '.yaml', '.yml', '.json', '.sql', '.md'];
    if (exts.some(e => lower.includes(e)))
        return true;
    if (text.includes('/'))
        return true;
    const codeKw = ['func ', 'function ', 'class ', 'interface ', 'struct ', 'const ', 'import ', 'export ', 'line '];
    if (codeKw.some(k => lower.includes(k)))
        return true;
    return false;
}
// ── scorePrompt — CARE framework, mirrors Go handlers.go ─────────────────────
function scorePrompt(pair) {
    const text = pair.user_text.trim();
    const tips = [];
    if (!text)
        return [1, ['Empty prompt — describe what you want done.']];
    // Image-only short prompts
    if (text.includes('[Image') && text.replace(/\s/g, '').length < 30) {
        return [2, [
                '[C] Add context: what project/file is this about?',
                '[A] Describe the task: what should Claude do with this image?',
            ]];
    }
    const lower = text.toLowerCase();
    const textLen = text.length;
    let score = 1; // start low — earn your score
    // ── C: CONTEXT (0-2 points) ──────────────────────────────────────────────
    let hasContext = false;
    if (isSpecificPrompt(text)) {
        score += 1;
        hasContext = true;
    }
    else {
        tips.push('[C] Context: mention file paths, function names, or line numbers so Claude knows WHERE to work.');
    }
    let hasRole = false;
    for (const kw of ['as a ', 'you are ', 'act as ', 'role:', 'persona', 'background:', 'context:']) {
        if (lower.includes(kw)) {
            hasRole = true;
            break;
        }
    }
    if (hasRole) {
        score += 1;
    }
    else if (textLen > 50 && hasContext) {
        score += 1;
    }
    // ── A: ASK / INSTRUCTION (0-3 points) ────────────────────────────────────
    const actionVerbs = ['fix', 'add', 'create', 'update', 'remove', 'refactor', 'implement', 'write', 'build', 'change', 'move', 'rename', 'test', 'debug', 'review', 'check', 'optimize', 'migrate', 'delete', 'replace', 'extract', 'split', 'merge', 'convert'];
    let hasAction = false;
    for (const w of actionVerbs) {
        if (lower.includes(w + ' ') || lower.includes(w + '\n') || lower.startsWith(w)) {
            hasAction = true;
            break;
        }
    }
    if (hasAction) {
        score += 1;
    }
    else {
        tips.push('[A] Ask: start with a clear action verb — fix, implement, add, refactor, create, etc.');
    }
    if (textLen >= 80) {
        score += 1;
    }
    else if (textLen < 30) {
        tips.push('[A] Ask: too brief — describe WHAT you want done and the expected behavior.');
    }
    const hasStructure = text.includes('\n') || text.includes('1.') || text.includes('- ') || text.includes('•');
    if (hasStructure && textLen >= 100)
        score += 1;
    // ── R: RULES / CONSTRAINTS (0-2 points) ──────────────────────────────────
    // Exclude "only"/"should" — appear in ordinary English sentences
    let hasConstraints = false;
    for (const kw of ["don't", 'do not', 'avoid', 'must not', 'without', 'ensure', 'make sure', 'never', 'always', 'constraint', 'requirement', 'rule:', 'important:', 'must be', 'must have']) {
        if (lower.includes(kw)) {
            hasConstraints = true;
            break;
        }
    }
    if (hasConstraints) {
        score += 1;
    }
    else {
        tips.push('[R] Rules: add constraints — what to avoid, boundaries, must-haves (e.g., "don\'t change the API", "must be backward compatible").');
    }
    let hasExpected = false;
    for (const kw of ['expect', 'should return', 'should output', 'result should', 'success criteria', 'acceptance criteria', 'expected output', 'expected result']) {
        if (lower.includes(kw)) {
            hasExpected = true;
            break;
        }
    }
    if (hasExpected)
        score += 1;
    // ── E: EXAMPLES / OUTPUT FORMAT (0-2 points) ─────────────────────────────
    // Removed "as a " (already in C), "list"/"output:" (too common), "give me a" (casual)
    let hasFormat = false;
    for (const kw of ['format:', 'example:', 'e.g.', 'for example', 'like this', 'such as', 'table', 'json', 'csv', 'markdown', 'return as', 'respond with']) {
        if (lower.includes(kw)) {
            hasFormat = true;
            break;
        }
    }
    if (hasFormat) {
        score += 1;
    }
    else {
        tips.push('[E] Examples: specify the desired output format (table, JSON, markdown) or give an example of what you expect.');
    }
    const hasCodeExample = text.includes('```') || text.includes('before:') || text.includes('after:') || text.includes('currently:');
    if (hasCodeExample)
        score += 1;
    // ── CARE structural cap ───────────────────────────────────────────────────
    let careCount = 0;
    if (hasContext || hasRole)
        careCount++;
    if (hasAction)
        careCount++;
    if (hasConstraints || hasExpected)
        careCount++;
    if (hasFormat || hasCodeExample)
        careCount++;
    if (careCount < 3 && score > 7)
        score = 7;
    // Clamp 1-10
    score = Math.max(1, Math.min(10, score));
    if (score < 10 && tips.length === 0) {
        tips.push('Try the CARE format: [C]ontext → [A]sk → [R]ules → [E]xamples for maximum clarity.');
    }
    if (tips.length > 4)
        tips.splice(4);
    return [score, tips];
}
class Store {
    constructor() {
        this.sessionList = [];
        this.conversationPairs = [];
    }
    sessions() {
        return [...this.sessionList];
    }
    addSession(session) {
        this.sessionList.push(session);
    }
    sessionsBySource(source) {
        return this.sessionList.filter(s => s.source === source);
    }
    async loadAll() {
        const adapters = [
            new claudecode_1.ClaudeCodeAdapter(),
            new copilot_1.CopilotAdapter(),
            new opencode_1.OpenCodeAdapter(),
            new windsurf_1.WindsurfAdapter()
        ];
        this.sessionList = [];
        this.conversationPairs = []; // reset cache when reloading
        for (const adapter of adapters) {
            const sessions = await adapter.getSessions();
            this.sessionList.push(...sessions);
        }
    }
    // ── statsForDays ───────────────────────────────────────────────────────────
    // Totals reflect only sessions within the N-day window (matches Go's computeStats).
    statsForDays(days) {
        const now = new Date();
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - (days - 1));
        return this._computeStats(this.sessionList, from, null);
    }
    // ── statsForRange ──────────────────────────────────────────────────────────
    statsForRange(from, to) {
        return this._computeStats(this.sessionList, from, to);
    }
    // ── statsForSourceDays ─────────────────────────────────────────────────────
    statsForSourceDays(source, days) {
        const now = new Date();
        const from = new Date(now);
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - (days - 1));
        return this._computeStats(this.sessionsBySource(source), from, null);
    }
    statsForSourceRange(source, from, to) {
        return this._computeStats(this.sessionsBySource(source), from, to);
    }
    // ── _computeStats — internal aggregation (mirrors Go store.computeStats) ──
    _computeStats(allSessions, from, to) {
        const sessions = allSessions.filter(s => {
            const t = new Date(s.start_time);
            if (from && t < from)
                return false;
            if (to && t > to)
                return false;
            return true;
        });
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCacheReadTokens = 0;
        let totalCacheCreationTokens = 0;
        let totalCost = 0;
        const toolCounts = {};
        const projectSet = new Set();
        const dailyMap = {};
        for (const sess of sessions) {
            totalInputTokens += sess.total_usage?.input_tokens || 0;
            totalOutputTokens += sess.total_usage?.output_tokens || 0;
            totalCacheReadTokens += sess.total_usage?.cache_read_input_tokens || 0;
            totalCacheCreationTokens += sess.total_usage?.cache_creation_input_tokens || 0;
            totalCost += tokenCost(sess.total_usage || {});
            if (sess.tool_counts) {
                for (const [tool, count] of Object.entries(sess.tool_counts)) {
                    toolCounts[tool] = (toolCounts[tool] || 0) + count;
                }
            }
            if (sess.project_dir)
                projectSet.add(sess.project_dir);
            const day = new Date(sess.start_time).toISOString().split('T')[0];
            if (day === '0001-01-01')
                continue;
            if (!dailyMap[day]) {
                dailyMap[day] = { date: day, input_tokens: 0, output_tokens: 0, cache_read: 0, cache_creation: 0, sessions: 0, est_cost_usd: 0 };
            }
            const d = dailyMap[day];
            d.input_tokens += sess.total_usage?.input_tokens || 0;
            d.output_tokens += sess.total_usage?.output_tokens || 0;
            d.cache_read += sess.total_usage?.cache_read_input_tokens || 0;
            d.cache_creation += sess.total_usage?.cache_creation_input_tokens || 0;
            d.sessions++;
            d.est_cost_usd += tokenCost(sess.total_usage || {});
        }
        const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        // Active session: modified within last 30 min (use sorted-first = most recent)
        let activeSession = null;
        const sorted = [...allSessions].sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
        if (sorted.length > 0) {
            const mostRecent = sorted[0];
            if (Date.now() - new Date(mostRecent.end_time).getTime() < 30 * 60 * 1000) {
                activeSession = mostRecent;
            }
        }
        const n = sessions.length;
        return {
            total_sessions: n,
            total_all_sessions: allSessions.length,
            total_input_tokens: totalInputTokens,
            total_output_tokens: totalOutputTokens,
            total_cache_read_tokens: totalCacheReadTokens,
            total_cache_creation_tokens: totalCacheCreationTokens,
            total_cost_usd: Math.round(totalCost * 100) / 100,
            avg_session_cost_usd: n > 0 ? Math.round((totalCost / n) * 1000) / 1000 : 0,
            avg_session_tokens: n > 0 ? Math.round((totalInputTokens + totalOutputTokens) / n) : 0,
            daily,
            tool_counts: toolCounts,
            projects: Array.from(projectSet).sort(),
            active_session: activeSession,
        };
    }
    // ── getConversations ───────────────────────────────────────────────────────
    async getConversations(page, limit, period, scoreMin, scoreMax) {
        if (this.conversationPairs.length === 0) {
            await this.extractConversationPairsFromFiles();
        }
        // Period filter
        let pairs = this.conversationPairs;
        if (period !== 'all') {
            const now = new Date();
            let cutoff;
            if (period === 'today') {
                cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            }
            else if (period === 'month') {
                cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }
            else {
                // 'week' is default
                cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }
            pairs = pairs.filter(p => new Date(p.timestamp) >= cutoff);
        }
        // Score filter
        if (scoreMin > 0 || scoreMax < 10) {
            pairs = pairs.filter(p => (p.prompt_score || 0) >= scoreMin && (p.prompt_score || 0) <= scoreMax);
        }
        const total = pairs.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const paged = pairs.slice(start, start + limit);
        return { pairs: paged, total, period, page, total_pages: totalPages };
    }
    // ── extractConversationPairsFromFiles ──────────────────────────────────────
    async extractConversationPairsFromFiles() {
        this.conversationPairs = [];
        const adapter = new claudecode_1.ClaudeCodeAdapter();
        for (const session of this.sessionList) {
            if (session.source !== 'claude-code' || !session.file_path)
                continue;
            try {
                const turns = await adapter.parseTurnsFull(session.file_path);
                for (let i = 0; i < turns.length; i++) {
                    if (turns[i].role !== 'user' || !turns[i].text)
                        continue;
                    const userTurn = turns[i];
                    // Skip system injections
                    if (isSystemInjection(userTurn.text))
                        continue;
                    // Collect ALL assistant turns until next user turn (matches Go logic)
                    const allToolCalls = [];
                    const allToolDetails = [];
                    let sumInput = 0, sumOutput = 0, sumCacheWrite = 0, lastCacheRead = 0;
                    let assistTurn = null;
                    let maxDurationMs = 0;
                    let lastJ = i;
                    for (let j = i + 1; j < turns.length; j++) {
                        if (turns[j].role === 'user')
                            break;
                        if (turns[j].role === 'assistant') {
                            lastJ = j;
                            const t = turns[j];
                            allToolCalls.push(...(t.tool_calls || []));
                            allToolDetails.push(...(t.tool_details || []));
                            if (t.usage) {
                                sumInput += t.usage.input_tokens || 0;
                                sumOutput += t.usage.output_tokens || 0;
                                sumCacheWrite += t.usage.cache_creation_input_tokens || 0;
                                lastCacheRead = t.usage.cache_read_input_tokens || 0;
                            }
                            if (t.duration_ms && t.duration_ms > maxDurationMs)
                                maxDurationMs = t.duration_ms;
                            if (t.text && !t.text.startsWith('[thinking]')) {
                                assistTurn = t;
                            }
                            else if (!assistTurn) {
                                assistTurn = t;
                            }
                        }
                    }
                    i = lastJ;
                    const pair = {
                        session_id: session.id,
                        project_dir: session.project_dir,
                        git_branch: session.git_branch,
                        model: assistTurn?.model || session.model,
                        user_text: userTurn.text, // no truncation — matches Go's ParseTurnsFull
                        assist_text: assistTurn?.text || '',
                        tool_calls: allToolCalls,
                        tool_details: allToolDetails.length > 0 ? allToolDetails : undefined,
                        timestamp: userTurn.timestamp,
                        duration_ms: maxDurationMs,
                        cost: 0,
                        context_pct: 0,
                        prompt_score: 0,
                        prompt_tips: [],
                    };
                    if (sumInput + sumOutput > 0) {
                        pair.usage = {
                            input_tokens: sumInput,
                            output_tokens: sumOutput,
                            cache_read_input_tokens: lastCacheRead,
                            cache_creation_input_tokens: sumCacheWrite,
                        };
                        // Cost: sum of fresh tokens + sum of cache writes + last cache_read
                        pair.cost = Math.round(tokenCost(pair.usage) * 10000) / 10000;
                        // Context% = (last cache_read + sum input) / window — depth at end of response
                        pair.context_pct = Math.round(((lastCacheRead + sumInput) / CONTEXT_WINDOW) * 100 * 10) / 10;
                    }
                    const [score, tips] = scorePrompt(pair);
                    pair.prompt_score = score;
                    pair.prompt_tips = tips;
                    this.conversationPairs.push(pair);
                }
            }
            catch {
                // skip unparseable sessions
            }
        }
        // Sort newest first
        this.conversationPairs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    // ── insights ───────────────────────────────────────────────────────────────
    insights() {
        const stats = this.statsForDays(30);
        const sessions = this.sessionList;
        const totalSessions = sessions.length;
        const avgTurns = totalSessions > 0
            ? sessions.reduce((sum, s) => sum + s.user_turns, 0) / totalSessions
            : 0;
        const avgToolDiversity = totalSessions > 0
            ? sessions.reduce((sum, s) => sum + Object.keys(s.tool_counts || {}).length, 0) / totalSessions
            : 0;
        const avgPromptScore = this.conversationPairs.length > 0
            ? Math.round(this.conversationPairs.reduce((sum, p) => sum + (p.prompt_score || 7), 0) / this.conversationPairs.length)
            : 7;
        let tier = 'Beginner';
        if (avgPromptScore >= 9)
            tier = 'Expert';
        else if (avgPromptScore >= 7)
            tier = 'Advanced';
        else if (avgPromptScore >= 5)
            tier = 'Intermediate';
        const specificCount = this.conversationPairs.filter(p => isSpecificPrompt(p.user_text)).length;
        const specificPct = this.conversationPairs.length > 0
            ? Math.round((specificCount / this.conversationPairs.length) * 100)
            : 0;
        const cacheCount = sessions.filter(s => (s.total_usage?.cache_read_input_tokens || 0) > 0).length;
        const cachePct = totalSessions > 0 ? Math.round((cacheCount / totalSessions) * 100) : 0;
        const agentSessions = sessions.filter(s => (s.tool_counts || {})['Agent'] > 0).length;
        const agentUsagePct = totalSessions > 0 ? Math.round((agentSessions / totalSessions) * 100) : 0;
        const totalInput = stats.total_input_tokens;
        const totalOutput = stats.total_output_tokens;
        const outputRatio = totalInput > 0 ? Math.round((totalOutput / totalInput) * 100) / 100 : 0;
        const highCtxSessions = sessions.filter(s => s.user_turns + s.assist_turns > 20).length;
        const avgPromptLen = this.conversationPairs.length > 0
            ? Math.round(this.conversationPairs.reduce((sum, p) => sum + p.user_text.length, 0) / this.conversationPairs.length)
            : 0;
        return {
            score: avgPromptScore,
            tier,
            dimensions: [
                {
                    label: 'Specificity',
                    score: Math.min(100, specificPct + 30),
                    tier: specificPct >= 70 ? 'Advanced' : specificPct >= 50 ? 'Intermediate' : 'Beginner',
                    value: `${specificPct}% specific`,
                    description: 'How specific and detailed your prompts are',
                },
                {
                    label: 'Tool Usage',
                    score: Math.min(100, agentUsagePct + 20),
                    tier: agentUsagePct >= 60 ? 'Advanced' : agentUsagePct >= 30 ? 'Intermediate' : 'Beginner',
                    value: `${agentUsagePct}% with agent`,
                    description: 'Leveraging available tools and agents',
                },
                {
                    label: 'Context Efficiency',
                    score: Math.min(100, avgTurns * 10),
                    tier: avgTurns >= 8 ? 'Advanced' : avgTurns >= 4 ? 'Intermediate' : 'Beginner',
                    value: `${avgTurns.toFixed(1)} avg turns`,
                    description: 'Efficiently using conversation context',
                },
                {
                    label: 'Cache Optimization',
                    score: Math.min(100, cachePct + 30),
                    tier: cachePct >= 50 ? 'Advanced' : cachePct >= 20 ? 'Intermediate' : 'Beginner',
                    value: `${cachePct}% using cache`,
                    description: 'Leveraging prompt caching for efficiency',
                },
            ],
            insights: [
                {
                    type: 'info',
                    title: 'Session Analysis',
                    text: `You have ${totalSessions} total sessions with an average of ${avgTurns.toFixed(1)} turns each.`,
                    impact: 'Helps establish your baseline usage patterns',
                },
                avgPromptScore >= 8 ? {
                    type: 'success',
                    title: 'Strong Prompt Quality',
                    text: 'Your prompts are detailed and specific, leading to better responses.',
                    impact: 'High-quality prompts reduce iteration and improve outcomes',
                } : {
                    type: 'warning',
                    title: 'Improve Prompt Specificity',
                    text: 'Adding more context and specific examples could improve results.',
                    impact: 'More specific prompts lead to better, more focused responses',
                },
                agentUsagePct < 30 ? {
                    type: 'info',
                    title: 'Explore Tool Usage',
                    text: `You use agent in only ${agentUsagePct}% of sessions. Consider delegating sub-tasks to agents.`,
                    impact: 'Agents enable Claude to take real actions on your behalf',
                } : {
                    type: 'success',
                    title: 'Effective Agent Usage',
                    text: `You actively use agents in ${agentUsagePct}% of sessions.`,
                    impact: 'Agent usage leads to more practical and immediately useful responses',
                },
            ],
            cache_pct: cachePct,
            avg_turns: Math.round(avgTurns * 10) / 10,
            high_ctx_sessions: highCtxSessions,
            specific_pct: specificPct,
            total_sessions: totalSessions,
            avg_prompt_len: avgPromptLen,
            output_ratio: outputRatio,
            ownership_pct: specificPct,
            agent_usage_pct: agentUsagePct,
            avg_tool_diversity: Math.round(avgToolDiversity * 10) / 10,
        };
    }
    // ── tasks ──────────────────────────────────────────────────────────────────
    tasks() {
        const projectMap = new Map();
        for (const session of this.sessionList) {
            if (!session.project_dir)
                continue;
            if (!projectMap.has(session.project_dir)) {
                projectMap.set(session.project_dir, {
                    project_dir: session.project_dir,
                    completed: 0,
                    in_progress: 0,
                    pending: 0,
                    tasks: [],
                });
            }
            const proj = projectMap.get(session.project_dir);
            proj.tasks.push({
                id: session.id.substring(0, 8),
                subject: `Session: ${session.first_prompt?.substring(0, 50) || 'Untitled'}`,
                description: `${session.user_turns} turns, ${session.assist_turns} responses`,
                status: 'completed',
                session_id: session.id,
                session_date: new Date(session.start_time).toISOString().split('T')[0],
                project_dir: session.project_dir,
            });
            if (proj.tasks.length === 1) {
                proj.tasks[0].status = 'in_progress';
                proj.in_progress = 1;
            }
            else {
                proj.completed++;
            }
        }
        const projects = Array.from(projectMap.values());
        let totalTasks = 0, totalCompleted = 0, totalInProgress = 0;
        for (const proj of projects) {
            proj.completion_rate = proj.tasks.length > 0 ? Math.round((proj.completed / proj.tasks.length) * 100) : 0;
            totalTasks += proj.tasks.length;
            totalCompleted += proj.completed;
            totalInProgress += proj.in_progress;
        }
        return {
            summary: {
                total: totalTasks,
                completed: totalCompleted,
                in_progress: totalInProgress,
                pending: totalTasks - totalCompleted - totalInProgress,
            },
            projects,
        };
    }
    // ── Analytics breakdown helpers ───────────────────────────────────────────
    /** Returns sessions filtered by ?days / ?from+to query-param semantics. */
    filterByQuery(days, from, to) {
        const all = this.sessionList;
        if (!from && !to && days <= 0)
            return all;
        const cutoff = (from || (days > 0 ? new Date(Date.now() - days * 86400000) : null));
        return all.filter(s => {
            const t = new Date(s.start_time);
            if (cutoff && t < cutoff)
                return false;
            if (to && t > to)
                return false;
            return true;
        });
    }
    /** Cost breakdown aggregated by project_dir. */
    statsByProject(days, from, to) {
        const sessions = this.filterByQuery(days, from, to);
        const map = new Map();
        for (const s of sessions) {
            const key = s.project_dir || 'unknown';
            const row = map.get(key) || { project: key, sessions: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
            row.sessions++;
            row.input_tokens += s.total_usage?.input_tokens || 0;
            row.output_tokens += s.total_usage?.output_tokens || 0;
            row.cost_usd += tokenCost(s.total_usage || {});
            map.set(key, row);
        }
        const projects = Array.from(map.values())
            .map(r => ({ ...r, cost_usd: Math.round(r.cost_usd * 100) / 100 }))
            .sort((a, b) => b.cost_usd - a.cost_usd);
        return { projects, total: projects.length };
    }
    /** Token & cost breakdown aggregated by model. */
    statsByModel(days, from, to) {
        const sessions = this.filterByQuery(days, from, to);
        const map = new Map();
        for (const s of sessions) {
            const key = s.model || 'unknown';
            const row = map.get(key) || { model: key, sessions: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
            row.sessions++;
            row.input_tokens += s.total_usage?.input_tokens || 0;
            row.output_tokens += s.total_usage?.output_tokens || 0;
            row.cost_usd += tokenCost(s.total_usage || {});
            map.set(key, row);
        }
        const models = Array.from(map.values())
            .map(r => ({ ...r, cost_usd: Math.round(r.cost_usd * 100) / 100 }))
            .sort((a, b) => b.cost_usd - a.cost_usd);
        return { models, total: models.length };
    }
    /** Classify a first_prompt string into an activity label — mirrors Go classifyActivity(). */
    classifyActivity(prompt) {
        const p = (prompt || '').toLowerCase();
        const has = (kws) => kws.some(k => p.includes(k));
        if (has(['debug', 'fix', 'error', 'bug', 'crash', 'fail', 'broken', 'issue', 'exception', 'traceback', 'panic']))
            return 'Debugging';
        if (has(['refactor', 'clean', 'simplify', 'reorganise', 'reorganize', 'restructure', 'rename', 'move', 'extract']))
            return 'Refactoring';
        if (has(['add feature', 'implement', 'build', 'create', 'new endpoint', 'new component', 'new page', 'new route', 'add support', 'add the ability']))
            return 'Feature Dev';
        if (has(['subagent', 'agent', 'delegate', 'spawn', 'orchestrat', 'pipeline', 'workflow']))
            return 'Delegation';
        if (has(['write test', 'add test', 'unit test', 'integration test', 'spec', 'coverage', 'jest', 'pytest', 'phpunit']))
            return 'Testing';
        if (has(['write code', 'implement', 'function', 'class', 'struct', 'method', 'api', 'endpoint', 'sql', 'query', 'migration', 'schema']))
            return 'Coding';
        if (has(['explain', 'what is', 'how does', 'describe', 'understand', 'explore', 'analyse', 'analyze', 'review', 'read', 'look at']))
            return 'Exploration';
        return 'Other';
    }
    /** Session count breakdown by classified work type. */
    statsByActivity(days, from, to) {
        const sessions = this.filterByQuery(days, from, to);
        const counts = {};
        const costs = {};
        for (const s of sessions) {
            const act = this.classifyActivity(s.first_prompt || '');
            counts[act] = (counts[act] || 0) + 1;
            costs[act] = (costs[act] || 0) + tokenCost(s.total_usage || {});
        }
        const order = ['Coding', 'Debugging', 'Feature Dev', 'Exploration', 'Refactoring', 'Testing', 'Delegation', 'Other'];
        const total = sessions.length;
        const activities = order
            .filter(a => counts[a])
            .map(a => ({
            activity: a,
            sessions: counts[a],
            cost_usd: Math.round((costs[a] || 0) * 100) / 100,
            pct: total > 0 ? Math.round(counts[a] / total * 1000) / 10 : 0,
        }));
        return { activities, total };
    }
    /** Top CLI commands extracted from tool_samples["Bash"]. */
    shellCommands(days, from, to) {
        const sessions = this.filterByQuery(days, from, to);
        const cmdCounts = {};
        for (const s of sessions) {
            const samples = s.tool_samples?.Bash || [];
            for (const sample of samples) {
                const trimmed = sample.trim();
                if (!trimmed)
                    continue;
                const parts = trimmed.split(/\s+/);
                let cmd = parts[0];
                if (cmd === 'sudo' && parts[1])
                    cmd = parts[1];
                if (cmd === '$' && parts[1])
                    cmd = parts[1];
                if (cmd && cmd.length <= 20 && !cmd.includes('/')) {
                    cmdCounts[cmd] = (cmdCounts[cmd] || 0) + 1;
                }
            }
        }
        const commands = Object.entries(cmdCounts)
            .map(([command, count]) => ({ command, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);
        return { commands, total: Object.keys(cmdCounts).length };
    }
    /** Tool call counts grouped by MCP server name. */
    mcpServers(days, from, to) {
        const sessions = this.filterByQuery(days, from, to);
        const serverCounts = {};
        for (const s of sessions) {
            for (const [tool, count] of Object.entries(s.tool_counts || {})) {
                if (tool.startsWith('mcp__')) {
                    const parts = tool.split('__');
                    if (parts.length >= 2) {
                        serverCounts[parts[1]] = (serverCounts[parts[1]] || 0) + count;
                    }
                }
            }
        }
        const servers = Object.entries(serverCounts)
            .map(([server, calls]) => ({ server, calls }))
            .sort((a, b) => b.calls - a.calls);
        return { servers, total: servers.length };
    }
    // ── parseTurns ─────────────────────────────────────────────────────────────
    async parseTurns(sessionId) {
        const session = this.sessionList.find(s => s.id === sessionId);
        if (!session)
            return [];
        let adapter;
        switch (session.source) {
            case 'claude-code':
                adapter = new claudecode_1.ClaudeCodeAdapter();
                break;
            case 'github-copilot':
                adapter = new copilot_1.CopilotAdapter();
                break;
            case 'opencode':
                adapter = new opencode_1.OpenCodeAdapter();
                break;
            case 'windsurf':
                adapter = new windsurf_1.WindsurfAdapter();
                break;
            default: return [];
        }
        try {
            const filePath = session.file_path;
            if (!filePath)
                return [];
            return await adapter.parseTurnsFull(filePath) || [];
        }
        catch {
            return [];
        }
    }
}
exports.Store = Store;
