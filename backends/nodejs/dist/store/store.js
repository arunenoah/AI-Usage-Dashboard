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
 */
class Store {
    constructor() {
        this.sessionList = [];
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
}
exports.Store = Store;
