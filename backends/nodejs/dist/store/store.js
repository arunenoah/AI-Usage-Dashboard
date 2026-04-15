"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
const claudecode_1 = require("../adapters/claudecode");
const copilot_1 = require("../adapters/copilot");
const opencode_1 = require("../adapters/opencode");
const windsurf_1 = require("../adapters/windsurf");
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
class Store {
    constructor() {
        this.sessionList = [];
        this.conversationPairs = [];
    }
    /**
     * Returns a copy of all stored sessions
     * @returns Copy of sessions array to prevent external modification
     */
    sessions() {
        return [...this.sessionList];
    }
    /**
     * Adds a session to the store
     * @param session Session to add
     */
    addSession(session) {
        this.sessionList.push(session);
    }
    /**
     * Filters sessions by source
     * @param source The source to filter by (claude-code, github-copilot, opencode, windsurf)
     * @returns Array of sessions matching the source
     */
    sessionsBySource(source) {
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
    async loadAll() {
        const adapters = [
            new claudecode_1.ClaudeCodeAdapter(),
            new copilot_1.CopilotAdapter(),
            new opencode_1.OpenCodeAdapter(),
            new windsurf_1.WindsurfAdapter()
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
    statsForDays(days) {
        const result = [];
        const today = new Date();
        // Generate daily stats for each day, starting from today going backwards
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            // Initialize daily stats for this date
            const dailyStats = {
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
                // Cost calculation: $0.003 per 1M input tokens, $0.015 per 1M output tokens
                const inputCost = ((session.total_usage?.input_tokens || 0) / 1000000) * 0.003;
                const outputCost = ((session.total_usage?.output_tokens || 0) / 1000000) * 0.015;
                dailyStats.est_cost_usd += inputCost + outputCost;
            });
            result.push(dailyStats);
        }
        // Aggregate totals
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCost = 0;
        const toolCounts = {};
        const projectSet = new Set();
        let activeSession = null;
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
            const inputCost = ((session.total_usage?.input_tokens || 0) / 1000000) * 0.003;
            const outputCost = ((session.total_usage?.output_tokens || 0) / 1000000) * 0.015;
            totalCost += inputCost + outputCost;
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
    statsForRange(from, to) {
        const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
        const result = [];
        const current = new Date(from);
        // Generate daily stats for each day in range
        while (current <= to) {
            const dateStr = current.toISOString().split('T')[0];
            // Initialize daily stats for this date
            const dailyStats = {
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
                dailyStats.est_cost_usd += inputCost + outputCost;
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
        let totalCost = 0;
        const toolCounts = {};
        const projectSet = new Set();
        rangeSessions.forEach(session => {
            totalInputTokens += session.total_usage?.input_tokens || 0;
            totalOutputTokens += session.total_usage?.output_tokens || 0;
            const inputCost = ((session.total_usage?.input_tokens || 0) / 1000000) * 0.003;
            const outputCost = ((session.total_usage?.output_tokens || 0) / 1000000) * 0.015;
            totalCost += inputCost + outputCost;
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
    async getConversations(page = 1, limit = 20) {
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
    async extractConversationPairsFromFiles() {
        this.conversationPairs = [];
        const adapter = new claudecode_1.ClaudeCodeAdapter();
        const copilotAdapter = new copilot_1.CopilotAdapter();
        for (const session of this.sessionList) {
            try {
                let turns = [];
                // Use the appropriate adapter based on session source
                if (session.source === 'claude-code' && session.file_path) {
                    turns = await adapter.parseTurnsFull(session.file_path);
                }
                else if (session.source === 'github-copilot' && session.file_path) {
                    // For now, use stored pairs or skip Copilot
                    continue;
                }
                // Build conversation pairs from turns
                for (let i = 0; i < turns.length; i++) {
                    if (turns[i].role === 'user' && turns[i].text) {
                        // Find the corresponding assistant turns
                        let j = i + 1;
                        const allToolCalls = [];
                        const allToolDetails = [];
                        let sumInput = 0, sumOutput = 0, sumCacheWrite = 0, lastCacheRead = 0;
                        let assistTurn = null;
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
                            }
                            else if (!assistTurn) {
                                assistTurn = turn;
                            }
                            j++;
                        }
                        // Build pair
                        const pair = {
                            session_id: session.id,
                            project_dir: session.project_dir,
                            git_branch: session.git_branch,
                            model: session.model,
                            user_text: turns[i].text.substring(0, 1000),
                            assist_text: assistTurn?.text?.substring(0, 1000) || '',
                            tool_calls: allToolCalls,
                            tool_details: allToolDetails.length > 0 ? allToolDetails : undefined,
                            timestamp: turns[i].timestamp,
                            duration_ms: maxDurationMs,
                            cost: 0,
                            prompt_score: 7
                        };
                        // Calculate cost
                        if (sumInput + sumOutput > 0) {
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
                            pair.cost = inputCost + outputCost + cacheReadCost + cacheWriteCost;
                        }
                        this.conversationPairs.push(pair);
                        i = j - 1; // Skip processed assistant turns
                    }
                }
            }
            catch (err) {
                // Skip sessions that can't be parsed
            }
        }
        // Sort by timestamp descending (most recent first)
        this.conversationPairs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    /**
     * Calculate insights and recommendations
     * @returns InsightsResponse with analysis
     */
    insights() {
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
            ? Math.round(this.conversationPairs.reduce((sum, p) => sum + (p.prompt_score || 7), 0) /
                this.conversationPairs.length)
            : 7;
        // Determine tier based on average score
        let tier = 'Bronze';
        if (avgPromptScore >= 8) {
            tier = 'Gold';
        }
        else if (avgPromptScore >= 7) {
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
        const cacheCount = this.sessionList.filter(s => (s.total_usage?.cache_read_input_tokens || 0) > 0).length;
        const cachePct = totalSessions > 0
            ? Math.round((cacheCount / totalSessions) * 100)
            : 0;
        // Calculate agent usage percentage (prompts using tools)
        const agentCount = this.conversationPairs.filter(p => p.tool_calls && p.tool_calls.length > 0).length;
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
        const highCtxSessions = this.sessionList.filter(s => s.user_turns + s.assist_turns > 20).length;
        // Average prompt length
        const avgPromptLen = this.conversationPairs.length > 0
            ? Math.round(this.conversationPairs.reduce((sum, p) => sum + p.user_text.length, 0) /
                this.conversationPairs.length)
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
exports.Store = Store;
