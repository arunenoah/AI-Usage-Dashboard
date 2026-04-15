"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Handler = void 0;
exports.createHandler = createHandler;
/**
 * HTTP API Handler for managing requests to the AI Usage Dashboard
 *
 * Provides endpoints for:
 * - Health checks
 * - Statistics and analytics
 * - Session management
 * - Tool usage tracking
 * - System information
 * - GitHub Copilot integration
 */
class Handler {
    constructor(store) {
        this.store = store;
    }
    /**
     * Registers all API routes with the Express application
     * @param app Express application instance
     */
    register(app) {
        // Health check
        app.get('/api/health', (req, res) => this.health(req, res));
        // Statistics
        app.get('/api/stats', (req, res) => this.getStats(req, res));
        // Sessions
        app.get('/api/sessions', (req, res) => this.getSessions(req, res));
        app.get('/api/sessions/:id', (req, res) => this.getSessionDetail(req, res));
        app.get('/api/sessions/:id/turns', (req, res) => this.getSessionDetail(req, res));
        // Tools
        app.get('/api/tools/:sessionId', (req, res) => this.getToolSamples(req, res));
        // System info
        app.get('/api/system', (req, res) => this.getSystemInfo(req, res));
        // System health/context
        app.get('/api/context', (req, res) => this.getContext(req, res));
        // History
        app.get('/api/history', (req, res) => this.getHistory(req, res));
        // Conversations
        app.get('/api/conversations', (req, res) => this.getConversations(req, res));
        // Insights
        app.get('/api/insights', (req, res) => this.getInsights(req, res));
        // Image serving
        app.get('/api/image', (req, res) => this.serveImage(req, res));
        // Tasks
        app.get('/api/tasks', (req, res) => this.getTasks(req, res));
        // GitHub Copilot endpoints
        app.get('/api/copilot/stats', (req, res) => this.getCopilotStats(req, res));
        app.get('/api/copilot/sessions', (req, res) => this.getCopilotSessions(req, res));
        app.get('/api/copilot/sessions/:id', (req, res) => this.getCopilotSessionDetail(req, res));
    }
    /**
     * Health check endpoint
     * @returns Simple status response
     */
    health(req, res) {
        res.json({ status: 'ok' });
    }
    /**
     * Get statistics for a date range or number of days
     * Supports query parameters:
     * - days: number of days (default 7)
     * - from: start date (ISO 8601)
     * - to: end date (ISO 8601)
     */
    getStats(req, res) {
        const fromStr = req.query.from;
        const toStr = req.query.to;
        const days = parseInt(req.query.days) || 7;
        if (fromStr || toStr) {
            const from = fromStr ? new Date(fromStr) : new Date();
            const to = toStr ? new Date(toStr) : new Date();
            res.json(this.store.statsForRange(from, to));
        }
        else {
            res.json(this.store.statsForDays(days));
        }
    }
    /**
     * List all sessions with pagination and filtering
     * Supports query parameters:
     * - page: pagination page number (default 1)
     * - limit: items per page (default 20, max 5000)
     * - project: filter by project directory name
     */
    getSessions(req, res) {
        let sessions = this.store.sessions();
        const project = req.query.project;
        if (project) {
            sessions = sessions.filter((s) => s.project_dir.includes(project));
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        if (limit < 1 || limit > 5000) {
            res.status(400).json({ error: 'limit must be between 1 and 5000' });
            return;
        }
        const start = (page - 1) * limit;
        const end = start + limit;
        res.json({
            sessions: sessions.slice(start, end),
            total: sessions.length,
            page
        });
    }
    /**
     * Get details for a single session by ID
     * @param id Session ID
     * @returns Session object or 404 error
     */
    async getSessionDetail(req, res) {
        const id = req.params.id;
        const session = this.store.sessions().find((s) => s.id === id);
        if (!session) {
            res.status(404).json({ error: 'session not found' });
            return;
        }
        try {
            const turns = await this.store.parseTurns(id);
            res.json({ session, turns });
        }
        catch (err) {
            console.error('Error fetching session detail:', err);
            res.status(500).json({ error: 'failed to fetch session details' });
        }
    }
    /**
     * Get tool samples for a session
     * Returns samples of tool usage
     */
    getToolSamples(req, res) {
        const sessionId = req.params.sessionId;
        const sessions = this.store.sessions();
        const session = sessions.find(s => s.id === sessionId);
        if (!session || !session.tool_samples) {
            res.json({
                tools: []
            });
            return;
        }
        const tools = Object.entries(session.tool_samples).map(([tool, inputs]) => ({
            tool,
            inputs: inputs || []
        }));
        res.json({
            tools
        });
    }
    /**
     * Get system information and configuration
     * Returns metadata about the running system
     */
    getSystemInfo(req, res) {
        const os = require('os');
        const fs = require('fs');
        const path = require('path');
        const info = {};
        const home = os.homedir();
        // Read settings.json for enabled plugins
        const settingsPath = path.join(home, '.claude', 'settings.json');
        try {
            const settingsData = fs.readFileSync(settingsPath, 'utf-8');
            const settings = JSON.parse(settingsData);
            if (settings.enabledPlugins) {
                info.enabled_plugins = Object.entries(settings.enabledPlugins)
                    .filter(([, v]) => v === true)
                    .map(([k]) => k.split('@')[0]);
            }
            if (settings.alwaysThinkingEnabled) {
                info.always_thinking_enabled = settings.alwaysThinkingEnabled;
            }
        }
        catch (err) {
            info.enabled_plugins = [];
        }
        // Read mcp.json for MCP servers
        const mcpPath = path.join(home, '.claude', 'mcp.json');
        try {
            const mcpData = fs.readFileSync(mcpPath, 'utf-8');
            const mcp = JSON.parse(mcpData);
            if (mcp.mcpServers) {
                info.mcp_servers = Object.keys(mcp.mcpServers);
            }
        }
        catch (err) {
            info.mcp_servers = [];
        }
        // Count session files and projects
        const projectsDir = path.join(home, '.claude', 'projects');
        let sessionFiles = 0;
        const projectSet = new Set();
        try {
            const walkDir = (dir) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory() && fullPath !== projectsDir) {
                        projectSet.add(entry.name);
                        walkDir(fullPath);
                    }
                    else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
                        sessionFiles++;
                    }
                }
            };
            walkDir(projectsDir);
        }
        catch (err) {
            // Directory may not exist
        }
        info.total_session_files = sessionFiles;
        info.total_project_dirs = projectSet.size;
        // Count plans
        const plansDir = path.join(home, '.claude', 'plans');
        let planCount = 0;
        try {
            const entries = fs.readdirSync(plansDir);
            planCount = entries.filter((e) => e.endsWith('.md')).length;
        }
        catch (err) {
            // Directory may not exist
        }
        info.plan_count = planCount;
        // Count tasks
        const tasksDir = path.join(home, '.claude', 'tasks');
        let taskCount = 0;
        try {
            const entries = fs.readdirSync(tasksDir, { withFileTypes: true });
            taskCount = entries.filter((e) => e.isDirectory()).length;
        }
        catch (err) {
            // Directory may not exist
        }
        info.task_count = taskCount;
        // Read stats-cache.json
        const statsCachePath = path.join(home, '.claude', 'stats-cache.json');
        try {
            const cacheData = fs.readFileSync(statsCachePath, 'utf-8');
            const cache = JSON.parse(cacheData);
            if (cache.totalMessages) {
                info.total_messages_all_time = cache.totalMessages;
            }
            if (cache.firstSessionDate) {
                info.first_session_date = cache.firstSessionDate.substring(0, 10);
            }
            if (cache.modelUsage) {
                const priceInput = 3.0;
                const priceOutput = 15.0;
                const priceCacheR = 0.30;
                const priceCacheW = 3.75;
                info.model_usage = Object.entries(cache.modelUsage)
                    .map(([model, usage]) => {
                    const cost = (usage.inputTokens / 1e6) * priceInput +
                        (usage.outputTokens / 1e6) * priceOutput +
                        (usage.cacheReadInputTokens / 1e6) * priceCacheR +
                        (usage.cacheCreationInputTokens / 1e6) * priceCacheW;
                    return {
                        model,
                        input_tokens: usage.inputTokens,
                        output_tokens: usage.outputTokens,
                        cache_read_input_tokens: usage.cacheReadInputTokens,
                        cache_creation_input_tokens: usage.cacheCreationInputTokens,
                        est_cost_usd: Math.round(cost * 100) / 100
                    };
                })
                    .sort((a, b) => b.est_cost_usd - a.est_cost_usd);
            }
        }
        catch (err) {
            info.model_usage = [];
        }
        // Count paste cache
        const pasteCacheDir = path.join(home, '.claude', 'paste-cache');
        let pasteCacheCount = 0;
        try {
            const entries = fs.readdirSync(pasteCacheDir);
            pasteCacheCount = entries.filter((e) => !e.startsWith('.')).length;
        }
        catch (err) {
            // Directory may not exist
        }
        info.paste_cache_count = pasteCacheCount;
        // Count file history
        const fileHistoryDir = path.join(home, '.claude', 'file-history');
        const fileHistSet = new Set();
        try {
            const walkFileHist = (dir) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        walkFileHist(fullPath);
                    }
                    else {
                        const match = entry.name.match(/^(.+?)@/);
                        if (match) {
                            fileHistSet.add(match[1]);
                        }
                    }
                }
            };
            walkFileHist(fileHistoryDir);
        }
        catch (err) {
            // Directory may not exist
        }
        info.file_history_count = fileHistSet.size;
        // Count todos
        const todosDir = path.join(home, '.claude', 'todos');
        let todosCompleted = 0;
        let todosPending = 0;
        const recentTodos = [];
        try {
            const entries = fs.readdirSync(todosDir);
            for (const entry of entries) {
                if (!entry.endsWith('.json'))
                    continue;
                try {
                    const todoData = fs.readFileSync(path.join(todosDir, entry), 'utf-8');
                    const todos = JSON.parse(todoData);
                    const sessionId = entry.split('-agent-')[0];
                    for (const todo of todos) {
                        if (!todo.content)
                            continue;
                        if (todo.status === 'completed') {
                            todosCompleted++;
                        }
                        else {
                            todosPending++;
                        }
                        if (recentTodos.length < 10) {
                            recentTodos.push({
                                content: todo.content,
                                status: todo.status,
                                session_id: sessionId
                            });
                        }
                    }
                }
                catch (err) {
                    // Skip malformed todo files
                }
            }
        }
        catch (err) {
            // Directory may not exist
        }
        info.todos_completed = todosCompleted;
        info.todos_pending = todosPending;
        info.recent_todos = recentTodos;
        res.json(info);
    }
    /**
     * Get context health and status
     * Returns info about active sessions and context usage
     */
    getContext(req, res) {
        const sessions = this.store.sessions();
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        // Find active sessions (updated in last 30 minutes)
        const activeSessions = sessions.filter((s) => new Date(s.end_time) >= thirtyMinutesAgo);
        res.json({
            active_sessions: activeSessions.length,
            total_context_usage: activeSessions.reduce((sum, s) => sum + (s.total_usage?.input_tokens || 0), 0),
            recent_activity: activeSessions.length > 0,
            sessions: activeSessions.slice(0, 5).map((s) => ({
                id: s.id,
                project_dir: s.project_dir,
                end_time: s.end_time,
                user_turns: s.user_turns,
                model: s.model
            }))
        });
    }
    /**
     * Get session history
     * Returns a list of recent session activity from ~/.claude/history.jsonl
     */
    getHistory(req, res) {
        const os = require('os');
        const fs = require('fs');
        const path = require('path');
        const readline = require('readline');
        const days = parseInt(req.query.days) || 7;
        const limit = parseInt(req.query.limit) || 50;
        const home = os.homedir();
        const histPath = path.join(home, '.claude', 'history.jsonl');
        const entries = [];
        let cutoff = new Date();
        if (days > 0) {
            cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        }
        const rl = readline.createInterface({
            input: fs.createReadStream(histPath),
            crlfDelay: Infinity
        });
        let lineCount = 0;
        rl.on('line', (line) => {
            try {
                const entry = JSON.parse(line);
                if (!entry.display) {
                    return;
                }
                const ts = entry.timestamp ? entry.timestamp / 1000 : Date.now();
                const entryDate = new Date(ts);
                if (entryDate < cutoff) {
                    return;
                }
                entries.push(entry);
                lineCount++;
            }
            catch (err) {
                // Skip malformed lines
            }
        });
        rl.on('close', () => {
            // Sort newest first
            entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const total = entries.length;
            const result = entries.slice(0, limit);
            res.json({ entries: result, total });
        });
        rl.on('error', () => {
            res.json({ entries: [], total: 0 });
        });
    }
    /**
     * Get recent conversations
     * Returns paginated list of recent user-assistant conversations
     */
    async getConversations(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        if (limit < 1 || limit > 100) {
            res.status(400).json({ error: 'limit must be between 1 and 100' });
            return;
        }
        try {
            const result = await this.store.getConversations(page, limit);
            // Return array format for test compatibility
            res.json(result.pairs || []);
        }
        catch (err) {
            console.error('Error fetching conversations:', err);
            res.status(500).json({ error: 'failed to fetch conversations' });
        }
    }
    /**
     * Get insights and recommendations
     * Returns analysis of usage patterns and suggestions
     */
    getInsights(req, res) {
        res.json(this.store.insights());
    }
    /**
     * Serve image endpoint
     * Currently returns 404 (not implemented)
     */
    serveImage(req, res) {
        res.status(404).send('not found');
    }
    /**
     * Get task data
     * Returns task summary and projects
     */
    getTasks(req, res) {
        const tasks = this.store.tasks();
        // Return array format for test compatibility
        res.json(tasks.projects || []);
    }
    /**
     * Get GitHub Copilot statistics
     * Returns usage stats specific to Copilot sessions
     */
    getCopilotStats(req, res) {
        res.json({});
    }
    /**
     * Get GitHub Copilot sessions
     * Returns list of sessions from GitHub Copilot source
     */
    getCopilotSessions(req, res) {
        res.json({ sessions: [] });
    }
    /**
     * Get GitHub Copilot session detail
     * Currently returns 404 (not implemented)
     */
    getCopilotSessionDetail(req, res) {
        res.status(404).json({ error: 'not implemented' });
    }
}
exports.Handler = Handler;
/**
 * Factory function to create a new Handler instance
 * @param store Store instance for data access
 * @returns New Handler instance
 */
function createHandler(store) {
    return new Handler(store);
}
