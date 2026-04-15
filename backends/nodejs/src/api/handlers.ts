import { Express, Request, Response } from 'express';
import { Store } from '../store/store';

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
export class Handler {
  constructor(private store: Store) {}

  /**
   * Registers all API routes with the Express application
   * @param app Express application instance
   */
  register(app: Express): void {
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
    app.get(
      '/api/copilot/sessions/:id',
      (req, res) => this.getCopilotSessionDetail(req, res)
    );
  }

  /**
   * Health check endpoint
   * @returns Simple status response
   */
  private health(req: Request, res: Response): void {
    res.json({ status: 'ok' });
  }

  /**
   * Get statistics for a date range or number of days
   * Supports query parameters:
   * - days: number of days (default 7)
   * - from: start date (ISO 8601)
   * - to: end date (ISO 8601)
   */
  private getStats(req: Request, res: Response): void {
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;
    const days = parseInt(req.query.days as string) || 7;

    if (fromStr || toStr) {
      const from = fromStr ? new Date(fromStr) : new Date();
      const to = toStr ? new Date(toStr) : new Date();
      res.json(this.store.statsForRange(from, to));
    } else {
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
  private getSessions(req: Request, res: Response): void {
    let sessions = this.store.sessions();

    const project = req.query.project as string;
    if (project) {
      sessions = sessions.filter((s) => s.project_dir.includes(project));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

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
  private getSessionDetail(req: Request, res: Response): void {
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
  private getToolSamples(req: Request, res: Response): void {
    res.json({
      total: 0,
      samples: []
    });
  }

  /**
   * Get system information and configuration
   * Returns metadata about the running system
   */
  private getSystemInfo(req: Request, res: Response): void {
    res.json({});
  }

  /**
   * Get session history
   * Returns a list of recent session activity
   */
  private getHistory(req: Request, res: Response): void {
    res.json([]);
  }

  /**
   * Get recent conversations
   * Returns paginated list of recent user-assistant conversations
   */
  private getConversations(req: Request, res: Response): void {
    res.json({
      pairs: [],
      total: 0,
      total_pages: 1,
      page: 1
    });
  }

  /**
   * Get insights and recommendations
   * Returns analysis of usage patterns and suggestions
   */
  private getInsights(req: Request, res: Response): void {
    res.json({});
  }

  /**
   * Serve image endpoint
   * Currently returns 404 (not implemented)
   */
  private serveImage(req: Request, res: Response): void {
    res.status(404).send('not found');
  }

  /**
   * Get task data
   * Returns task summary and projects
   */
  private getTasks(req: Request, res: Response): void {
    res.json({
      summary: {
        total: 0,
        completed: 0,
        in_progress: 0,
        pending: 0
      },
      projects: []
    });
  }

  /**
   * Get GitHub Copilot statistics
   * Returns usage stats specific to Copilot sessions
   */
  private getCopilotStats(req: Request, res: Response): void {
    res.json({});
  }

  /**
   * Get GitHub Copilot sessions
   * Returns list of sessions from GitHub Copilot source
   */
  private getCopilotSessions(req: Request, res: Response): void {
    res.json({ sessions: [] });
  }

  /**
   * Get GitHub Copilot session detail
   * Currently returns 404 (not implemented)
   */
  private getCopilotSessionDetail(req: Request, res: Response): void {
    res.status(404).json({ error: 'not implemented' });
  }
}

/**
 * Factory function to create a new Handler instance
 * @param store Store instance for data access
 * @returns New Handler instance
 */
export function createHandler(store: Store): Handler {
  return new Handler(store);
}
