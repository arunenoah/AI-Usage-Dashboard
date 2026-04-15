import { Session, DailyStats } from '../types/models';
import { ClaudeCodeAdapter } from '../adapters/claudecode';
import { CopilotAdapter } from '../adapters/copilot';
import { OpenCodeAdapter } from '../adapters/opencode';
import { WindsurfAdapter } from '../adapters/windsurf';

/**
 * In-memory session store for managing AI usage sessions
 *
 * Provides methods to:
 * - Store sessions in memory
 * - Filter sessions by source (claude-code, github-copilot, opencode, windsurf)
 * - Calculate daily statistics
 * - Calculate statistics for date ranges
 * - Load sessions from all configured adapters
 */
export class Store {
  private sessionList: Session[] = [];

  /**
   * Returns a copy of all stored sessions
   * @returns Copy of sessions array to prevent external modification
   */
  sessions(): Session[] {
    return [...this.sessionList];
  }

  /**
   * Adds a session to the store
   * @param session Session to add
   */
  addSession(session: Session): void {
    this.sessionList.push(session);
  }

  /**
   * Filters sessions by source
   * @param source The source to filter by (claude-code, github-copilot, opencode, windsurf)
   * @returns Array of sessions matching the source
   */
  sessionsBySource(source: string): Session[] {
    return this.sessionList.filter(s => s.source === source);
  }

  /**
   * Loads all sessions from all configured adapters
   *
   * Sequentially calls each adapter to retrieve sessions and merges
   * them into a single in-memory store. Adapters are called in order:
   * 1. Claude Code
   * 2. GitHub Copilot
   * 3. OpenCode
   * 4. Windsurf
   */
  async loadAll(): Promise<void> {
    const adapters = [
      new ClaudeCodeAdapter(),
      new CopilotAdapter(),
      new OpenCodeAdapter(),
      new WindsurfAdapter()
    ];

    this.sessionList = [];
    for (const adapter of adapters) {
      const sessions = await adapter.getSessions();
      this.sessionList.push(...sessions);
    }
  }

  /**
   * Calculates statistics for the last N days
   * @param days Number of days to calculate stats for
   * @returns Object containing daily stats array and summary totals
   */
  statsForDays(days: number): { daily: DailyStats[]; summary: any } {
    const result: DailyStats[] = [];
    const today = new Date();

    // Generate daily stats for each day, starting from today going backwards
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Initialize daily stats for this date
      const dailyStats: DailyStats = {
        date: dateStr,
        input_tokens: 0,
        output_tokens: 0,
        sessions: 0,
        est_cost_usd: 0
      };

      // Filter sessions for this date
      const daySessions = this.sessionList.filter(s => {
        const sDate = new Date(s.start_time).toISOString().split('T')[0];
        return sDate === dateStr;
      });

      dailyStats.sessions = daySessions.length;

      // Aggregate tokens and cost from all sessions in this day
      daySessions.forEach(session => {
        dailyStats.input_tokens += session.total_usage?.input_tokens || 0;
        dailyStats.output_tokens += session.total_usage?.output_tokens || 0;
        // Cost calculation: using a simplified model (can be enhanced later)
        // Rough estimate: $0.003 per 1M input tokens, $0.015 per 1M output tokens
        const inputCost = ((session.total_usage?.input_tokens || 0) / 1000000) * 0.003;
        const outputCost = ((session.total_usage?.output_tokens || 0) / 1000000) * 0.015;
        dailyStats.est_cost_usd += inputCost + outputCost;
      });

      result.push(dailyStats);
    }

    // Calculate summary totals
    const summary = {
      totalSessions: this.sessionList.length,
      totalTokens: result.reduce(
        (sum, d) => sum + d.input_tokens + d.output_tokens,
        0
      ),
      totalCost: result.reduce((sum, d) => sum + d.est_cost_usd, 0)
    };

    return {
      daily: result,
      summary
    };
  }

  /**
   * Calculates statistics for a date range
   * @param from Start date (inclusive)
   * @param to End date (inclusive)
   * @returns Object containing daily stats array and summary totals
   */
  statsForRange(from: Date, to: Date): { daily: DailyStats[]; summary: any } {
    const days = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    );
    return this.statsForDays(Math.max(days, 1));
  }
}
