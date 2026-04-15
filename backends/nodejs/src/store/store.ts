import { Session, DailyStats, ConversationPair, InsightsResponse } from '../types/models';
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
 * - Extract conversation pairs from sessions
 * - Calculate insights and recommendations
 */
export class Store {
  private sessionList: Session[] = [];
  private conversationPairs: ConversationPair[] = [];

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
   * @returns Object containing full stats matching Go backend schema
   */
  statsForDays(days: number): any {
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
        // Cost calculation: $0.003/1M input, $0.015/1M output, $0.30/1M cache_read, $3.75/1M cache_write
        const inputCost = ((session.total_usage?.input_tokens || 0) / 1000000) * 0.003;
        const outputCost = ((session.total_usage?.output_tokens || 0) / 1000000) * 0.015;
        const cacheReadCost = ((session.total_usage?.cache_read_input_tokens || 0) / 1000000) * 0.30;
        const cacheWriteCost = ((session.total_usage?.cache_creation_input_tokens || 0) / 1000000) * 3.75;
        dailyStats.est_cost_usd += inputCost + outputCost + cacheReadCost + cacheWriteCost;
      });

      result.push(dailyStats);
    }

    // Aggregate totals
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCost = 0;
    const toolCounts: { [key: string]: number } = {};
    const projectSet = new Set<string>();
    let activeSession: Session | null = null;

    // Check if most recent session is within last 30 minutes
    if (this.sessionList.length > 0) {
      const mostRecent = this.sessionList[0];
      const endTime = new Date(mostRecent.end_time);
      const now = new Date();
      if (now.getTime() - endTime.getTime() < 30 * 60 * 1000) {
        activeSession = mostRecent;
      }
    }

    this.sessionList.forEach(session => {
      totalInputTokens += session.total_usage?.input_tokens || 0;
      totalOutputTokens += session.total_usage?.output_tokens || 0;
      totalCacheReadTokens += session.total_usage?.cache_read_input_tokens || 0;
      totalCacheCreationTokens += session.total_usage?.cache_creation_input_tokens || 0;

      const inputCost = ((session.total_usage?.input_tokens || 0) / 1000000) * 0.003;
      const outputCost = ((session.total_usage?.output_tokens || 0) / 1000000) * 0.015;
      const cacheReadCost = ((session.total_usage?.cache_read_input_tokens || 0) / 1000000) * 0.30;
      const cacheWriteCost = ((session.total_usage?.cache_creation_input_tokens || 0) / 1000000) * 3.75;
      totalCost += inputCost + outputCost + cacheReadCost + cacheWriteCost;

      // Aggregate tool counts
      if (session.tool_counts) {
        Object.entries(session.tool_counts).forEach(([tool, count]) => {
          toolCounts[tool] = (toolCounts[tool] || 0) + count;
        });
      }

      // Track projects
      if (session.project_dir) {
        projectSet.add(session.project_dir);
      }
    });

    return {
      total_sessions: this.sessionList.length,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_cache_read_tokens: totalCacheReadTokens,
      total_cache_creation_tokens: totalCacheCreationTokens,
      total_cost_usd: totalCost,
      tool_counts: toolCounts,
      projects: Array.from(projectSet),
      active_session: activeSession,
      daily: result
    };
  }

  /**
   * Calculates statistics for a date range
   * @param from Start date (inclusive)
   * @param to End date (inclusive)
   * @returns Object containing full stats for the specified range
   */
  statsForRange(from: Date, to: Date): any {
    const days = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    );

    const result: DailyStats[] = [];
    const current = new Date(from);

    // Generate daily stats for each day in range
    while (current <= to) {
      const dateStr = current.toISOString().split('T')[0];

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
        const inputCost = ((session.total_usage?.input_tokens || 0) / 1000000) * 0.003;
        const outputCost = ((session.total_usage?.output_tokens || 0) / 1000000) * 0.015;
        const cacheReadCost = ((session.total_usage?.cache_read_input_tokens || 0) / 1000000) * 0.30;
        const cacheWriteCost = ((session.total_usage?.cache_creation_input_tokens || 0) / 1000000) * 3.75;
        dailyStats.est_cost_usd += inputCost + outputCost + cacheReadCost + cacheWriteCost;
      });

      result.push(dailyStats);
      current.setDate(current.getDate() + 1);
    }

    // Filter sessions to date range
    const rangeSessions = this.sessionList.filter(s => {
      const sDate = new Date(s.start_time);
      return sDate >= from && sDate <= to;
    });

    // Aggregate totals for range
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCost = 0;
    const toolCounts: { [key: string]: number } = {};
    const projectSet = new Set<string>();

    rangeSessions.forEach(session => {
      totalInputTokens += session.total_usage?.input_tokens || 0;
      totalOutputTokens += session.total_usage?.output_tokens || 0;
      totalCacheReadTokens += session.total_usage?.cache_read_input_tokens || 0;
      totalCacheCreationTokens += session.total_usage?.cache_creation_input_tokens || 0;

      const inputCost = ((session.total_usage?.input_tokens || 0) / 1000000) * 0.003;
      const outputCost = ((session.total_usage?.output_tokens || 0) / 1000000) * 0.015;
      const cacheReadCost = ((session.total_usage?.cache_read_input_tokens || 0) / 1000000) * 0.30;
      const cacheWriteCost = ((session.total_usage?.cache_creation_input_tokens || 0) / 1000000) * 3.75;
      totalCost += inputCost + outputCost + cacheReadCost + cacheWriteCost;

      if (session.tool_counts) {
        Object.entries(session.tool_counts).forEach(([tool, count]) => {
          toolCounts[tool] = (toolCounts[tool] || 0) + count;
        });
      }

      if (session.project_dir) {
        projectSet.add(session.project_dir);
      }
    });

    return {
      total_sessions: rangeSessions.length,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_cache_read_tokens: totalCacheReadTokens,
      total_cache_creation_tokens: totalCacheCreationTokens,
      total_cost_usd: totalCost,
      tool_counts: toolCounts,
      projects: Array.from(projectSet),
      active_session: null,
      daily: result
    };
  }

  /**
   * Get conversation pairs with pagination
   * @param page Page number (1-indexed)
   * @param limit Number of pairs per page
   * @returns Paginated conversation pairs
   */
  async getConversations(page: number = 1, limit: number = 20): Promise<any> {
    // Re-extract conversation pairs from sessions if needed
    if (this.conversationPairs.length === 0) {
      await this.extractConversationPairsFromFiles();
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const total = this.conversationPairs.length;
    const totalPages = Math.ceil(total / limit);

    return {
      pairs: this.conversationPairs.slice(start, end),
      total,
      page,
      total_pages: totalPages
    };
  }

  /**
   * Extract conversation pairs from JSONL files using parseTurnsFull
   */
  private async extractConversationPairsFromFiles(): Promise<void> {
    this.conversationPairs = [];
    const adapter = new ClaudeCodeAdapter();
    const copilotAdapter = new CopilotAdapter();

    for (const session of this.sessionList) {
      try {
        let turns: any[] = [];

        // Use the appropriate adapter based on session source
        if (session.source === 'claude-code' && (session as any).file_path) {
          turns = await (adapter as any).parseTurnsFull((session as any).file_path);
        } else if (session.source === 'github-copilot' && (session as any).file_path) {
          // For now, use stored pairs or skip Copilot
          continue;
        }

        // Build conversation pairs from turns
        for (let i = 0; i < turns.length; i++) {
          if (turns[i].role === 'user' && turns[i].text) {
            // Find the corresponding assistant turns
            let j = i + 1;
            const allToolCalls: string[] = [];
            const allToolDetails: any[] = [];
            let sumInput = 0, sumOutput = 0, sumCacheWrite = 0, lastCacheRead = 0;
            let assistTurn: any = null;
            let maxDurationMs = 0;

            while (j < turns.length && turns[j].role === 'assistant') {
              const turn = turns[j];
              allToolCalls.push(...turn.toolCalls);
              allToolDetails.push(...turn.toolDetails);
              if (turn.usage) {
                sumInput += turn.usage.inputTokens;
                sumOutput += turn.usage.outputTokens;
                sumCacheWrite += turn.usage.cacheCreationInputTokens || 0;
                lastCacheRead = turn.usage.cacheReadInputTokens || 0;
              }
              if (turn.durationMs && turn.durationMs > maxDurationMs) {
                maxDurationMs = turn.durationMs;
              }
              if (turn.text && !turn.text.startsWith('[thinking]')) {
                assistTurn = turn;
              } else if (!assistTurn) {
                assistTurn = turn;
              }
              j++;
            }

            // Calculate prompt score and tips
            const userText = turns[i].text;
            const assistText = assistTurn?.text || '';
            const promptScore = this.calculatePromptScore(userText, allToolCalls.length > 0);
            const promptTips = this.generatePromptTips(userText, assistText, allToolCalls.length > 0);

            // Build pair
            const pair: ConversationPair = {
              session_id: session.id,
              project_dir: session.project_dir,
              git_branch: session.git_branch,
              model: session.model,
              user_text: userText.substring(0, 1000),
              assist_text: assistText.substring(0, 1000),
              tool_calls: allToolCalls,
              tool_details: allToolDetails.length > 0 ? allToolDetails : undefined,
              timestamp: turns[i].timestamp,
              duration_ms: maxDurationMs,
              cost: 0,
              prompt_score: promptScore,
              prompt_tips: promptTips
            };

            // Calculate cost, usage, and context%
            if (sumInput + sumOutput > 0) {
              const contextWindow = 200000;
              pair.usage = {
                input_tokens: sumInput,
                output_tokens: sumOutput,
                cache_read_input_tokens: lastCacheRead,
                cache_creation_input_tokens: sumCacheWrite
              };
              const inputCost = (sumInput / 1000000) * 0.003;
              const outputCost = (sumOutput / 1000000) * 0.015;
              const cacheReadCost = (lastCacheRead / 1000000) * 0.30;
              const cacheWriteCost = (sumCacheWrite / 1000000) * 3.75;
              pair.cost = Math.round((inputCost + outputCost + cacheReadCost + cacheWriteCost) * 10000) / 10000;

              // Context% = (last cache_read + sum input) / window — shows depth at end of response
              const contextPct = (lastCacheRead + sumInput) / contextWindow * 100;
              pair.context_pct = Math.round(contextPct * 10) / 10;
            }

            this.conversationPairs.push(pair);
            i = j - 1; // Skip processed assistant turns
          }
        }
      } catch (err) {
        // Skip sessions that can't be parsed
      }
    }

    // Sort by timestamp descending (most recent first)
    this.conversationPairs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Calculate a prompt quality score (1-10)
   */
  private calculatePromptScore(userText: string, usedTools: boolean): number {
    let score = 7; // Base score

    // Length check
    if (userText.length < 10) {
      score -= 2;
    } else if (userText.length > 5000) {
      score -= 1;
    } else if (userText.length > 500) {
      score += 1;
    }

    // Specificity - look for specific terms
    const specificKeywords = ['specific', 'exact', 'particular', 'example', 'test', 'code', 'file'];
    if (specificKeywords.some(kw => userText.toLowerCase().includes(kw))) {
      score += 1;
    }

    // Tool usage indicates well-structured prompt
    if (usedTools) {
      score += 1;
    }

    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Generate prompt tips for improvement
   */
  private generatePromptTips(userText: string, assistText: string, usedTools: boolean): string[] {
    const tips: string[] = [];

    if (userText.length < 20) {
      tips.push('Try providing more context and details in your prompts');
    }

    if (!usedTools && assistText.length > 0) {
      tips.push('Consider asking the AI to use tools for more actionable results');
    }

    return tips.length > 0 ? tips : ['Great prompt! Keep being specific and detailed.'];
  }

  /**
   * Calculate insights and recommendations
   * @returns InsightsResponse with analysis
   */
  insights(): InsightsResponse {
    const stats = this.statsForDays(7);
    const totalSessions = this.sessionList.length;

    // Calculate metrics
    const avgTurns = totalSessions > 0
      ? this.sessionList.reduce((sum, s) => sum + s.user_turns, 0) / totalSessions
      : 0;

    const avgToolDiversity = totalSessions > 0
      ? this.sessionList.reduce((sum, s) => {
          const toolCount = Object.keys(s.tool_counts || {}).length;
          return sum + toolCount;
        }, 0) / totalSessions
      : 0;

    // Calculate average prompt score from conversation pairs
    const avgPromptScore = this.conversationPairs.length > 0
      ? Math.round(
          this.conversationPairs.reduce((sum, p) => sum + (p.prompt_score || 7), 0) /
          this.conversationPairs.length
        )
      : 7;

    // Determine tier based on average score
    let tier = 'Bronze';
    if (avgPromptScore >= 8) {
      tier = 'Gold';
    } else if (avgPromptScore >= 7) {
      tier = 'Silver';
    }

    // Calculate specificity percentage (prompts mentioning code/files)
    const specificCount = this.conversationPairs.filter(p => {
      const text = p.user_text.toLowerCase();
      return /\b(code|file|function|class|import|export)\b/.test(text);
    }).length;
    const specificPct = this.conversationPairs.length > 0
      ? Math.round((specificCount / this.conversationPairs.length) * 100)
      : 0;

    // Calculate cache usage percentage
    const cacheCount = this.sessionList.filter(s =>
      (s.total_usage?.cache_read_input_tokens || 0) > 0
    ).length;
    const cachePct = totalSessions > 0
      ? Math.round((cacheCount / totalSessions) * 100)
      : 0;

    // Calculate agent usage percentage (prompts using tools)
    const agentCount = this.conversationPairs.filter(p =>
      p.tool_calls && p.tool_calls.length > 0
    ).length;
    const agentUsagePct = this.conversationPairs.length > 0
      ? Math.round((agentCount / this.conversationPairs.length) * 100)
      : 0;

    // Calculate output ratio (output tokens / input tokens)
    const totalInputTokens = stats.total_input_tokens;
    const totalOutputTokens = stats.total_output_tokens;
    const outputRatio = totalInputTokens > 0
      ? Math.round((totalOutputTokens / totalInputTokens) * 100) / 100
      : 0;

    // Count high context sessions
    const highCtxSessions = this.sessionList.filter(s =>
      s.user_turns + s.assist_turns > 20
    ).length;

    // Average prompt length
    const avgPromptLen = this.conversationPairs.length > 0
      ? Math.round(
          this.conversationPairs.reduce((sum, p) => sum + p.user_text.length, 0) /
          this.conversationPairs.length
        )
      : 0;

    return {
      score: avgPromptScore,
      tier,
      dimensions: [
        {
          label: 'Specificity',
          score: Math.min(100, specificPct + 30),
          tier: specificPct >= 70 ? 'Gold' : specificPct >= 50 ? 'Silver' : 'Bronze',
          value: `${specificPct}% specific`,
          description: 'How specific and detailed your prompts are'
        },
        {
          label: 'Tool Usage',
          score: Math.min(100, agentUsagePct + 20),
          tier: agentUsagePct >= 60 ? 'Gold' : agentUsagePct >= 30 ? 'Silver' : 'Bronze',
          value: `${agentUsagePct}% with tools`,
          description: 'Leveraging available tools and agents'
        },
        {
          label: 'Context Efficiency',
          score: Math.min(100, avgTurns * 10),
          tier: avgTurns >= 8 ? 'Gold' : avgTurns >= 4 ? 'Silver' : 'Bronze',
          value: `${avgTurns.toFixed(1)} avg turns`,
          description: 'Efficiently using conversation context'
        },
        {
          label: 'Cache Optimization',
          score: Math.min(100, cachePct + 30),
          tier: cachePct >= 50 ? 'Gold' : cachePct >= 20 ? 'Silver' : 'Bronze',
          value: `${cachePct}% using cache`,
          description: 'Leveraging prompt caching for efficiency'
        }
      ],
      insights: [
        {
          type: 'info',
          title: 'Session Analysis',
          text: `You have ${totalSessions} total sessions with an average of ${avgTurns.toFixed(1)} turns each.`,
          impact: 'Helps establish your baseline usage patterns'
        },
        avgPromptScore >= 8 ? {
          type: 'success',
          title: 'Strong Prompt Quality',
          text: 'Your prompts are detailed and specific, leading to better responses.',
          impact: 'High-quality prompts reduce iteration and improve outcomes'
        } : {
          type: 'warning',
          title: 'Improve Prompt Specificity',
          text: 'Adding more context and specific examples could improve results.',
          impact: 'More specific prompts lead to better, more focused responses'
        },
        agentUsagePct < 30 ? {
          type: 'info',
          title: 'Explore Tool Usage',
          text: `You use tools in only ${agentUsagePct}% of conversations. Consider requesting tool usage for more actionable results.`,
          impact: 'Tools enable the AI to take real actions on your behalf'
        } : {
          type: 'success',
          title: 'Effective Tool Usage',
          text: `You actively use tools in ${agentUsagePct}% of conversations.`,
          impact: 'Tool usage leads to more practical and immediately useful responses'
        }
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
      avg_tool_diversity: Math.round(avgToolDiversity * 10) / 10
    };
  }
}
