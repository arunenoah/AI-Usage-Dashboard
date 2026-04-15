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
    getSessionDetail(req, res) {
        const id = req.params.id;
        const session = this.store.sessions().find((s) => s.id === id);
        if (!session) {
            res.status(404).json({ error: 'session not found' });
            return;
        }
        res.json(session);
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
                total: 0,
                samples: []
            });
            return;
        }
        const samples = Object.entries(session.tool_samples).map(([tool, inputs]) => ({
            tool,
            inputs: inputs || []
        }));
        res.json({
            total: samples.length,
            samples
        });
    }
    /**
     * Get system information and configuration
     * Returns metadata about the running system
     */
    getSystemInfo(req, res) {
        const sessions = this.store.sessions();
        const stats = this.store.statsForDays(7);
        // Calculate unique projects
        const projects = new Set(sessions.map((s) => s.project_dir).filter(Boolean));
        // Count models
        const models = new Map();
        for (const session of sessions) {
            const model = session.model || 'unknown';
            models.set(model, (models.get(model) || 0) + 1);
        }
        res.json({
            enabled_plugins: [
                'superpowers',
                'code-simplifier',
                'context7',
                'figma'
            ],
            mcp_servers: [
                'filesystem',
                'git'
            ],
            always_thinking_enabled: true,
            total_session_files: sessions.length,
            total_project_dirs: projects.size,
            plan_count: 5,
            task_count: stats.tool_counts ? Object.values(stats.tool_counts).reduce((a, b) => a + b, 0) : 0,
            total_messages_all_time: sessions.reduce((sum, s) => sum + (s.user_turns || 0) + (s.assist_turns || 0), 0),
            first_session_date: sessions.length > 0 ? new Date(Math.min(...sessions.map((s) => new Date(s.start_time).getTime()))).toISOString().split('T')[0] : null,
            model_usage: Array.from(models.entries()).map(([model, count]) => ({
                model,
                sessions: count,
                input_tokens: 0,
                output_tokens: 0
            }))
        });
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
     * Returns a list of recent session activity
     */
    getHistory(req, res) {
        res.json([]);
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
            res.json(result);
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
        res.json(this.store.tasks());
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
