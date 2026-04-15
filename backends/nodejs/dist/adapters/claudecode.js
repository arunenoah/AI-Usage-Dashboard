"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeAdapter = void 0;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const fs_1 = require("fs");
const readline_1 = require("readline");
/**
 * Adapter for Claude Code sessions
 *
 * Loads sessions from Claude Code's project directory at ~/.claude/projects
 * Parses detailed JSONL data to extract tool usage, token metrics, and activity
 */
class ClaudeCodeAdapter {
    /**
     * Parse full turns from a JSONL file (for conversation extraction)
     */
    async parseTurnsFull(filePath) {
        return new Promise((resolve) => {
            const turns = [];
            const seenUUIDs = new Set();
            const lineReader = (0, readline_1.createInterface)({
                input: (0, fs_1.createReadStream)(filePath),
                crlfDelay: Infinity
            });
            lineReader.on('line', (line) => {
                try {
                    const entry = JSON.parse(line);
                    // Skip duplicates
                    if (entry.type && entry.type !== 'user' && entry.type !== 'assistant') {
                        return;
                    }
                    if (entry.type === 'user') {
                        let text = '';
                        if (entry.message?.content) {
                            if (typeof entry.message.content === 'string') {
                                text = entry.message.content;
                            }
                            else if (Array.isArray(entry.message.content)) {
                                const textBlock = entry.message.content.find((c) => c.type === 'text');
                                text = textBlock?.text || '';
                            }
                        }
                        // Skip tool_result-only turns
                        if (text && !text.startsWith('[Request interrupted')) {
                            turns.push({
                                role: 'user',
                                text: text.substring(0, 10000), // Limit to 10k chars
                                timestamp: entry.timestamp || new Date().toISOString(),
                                toolCalls: [],
                                toolDetails: []
                            });
                        }
                    }
                    else if (entry.type === 'assistant') {
                        let text = '';
                        let toolCalls = [];
                        let toolDetails = [];
                        const usage = entry.message?.usage;
                        if (entry.message?.content) {
                            if (typeof entry.message.content === 'string') {
                                text = entry.message.content;
                            }
                            else if (Array.isArray(entry.message.content)) {
                                const contentBlocks = entry.message.content;
                                // Extract text
                                const textBlock = contentBlocks.find((c) => c.type === 'text');
                                if (textBlock) {
                                    text = textBlock.text || '';
                                }
                                // Extract thinking
                                if (!text) {
                                    const thinkingBlock = contentBlocks.find((c) => c.type === 'thinking');
                                    if (thinkingBlock) {
                                        text = '[thinking] ' + (thinkingBlock.thinking || '').substring(0, 200);
                                    }
                                }
                                // Extract tool calls
                                for (const block of contentBlocks) {
                                    if (block.type === 'tool_use' && block.name) {
                                        toolCalls.push(block.name);
                                        const detail = { tool: block.name };
                                        // Extract input based on tool type
                                        if (block.input && typeof block.input === 'object') {
                                            const input = block.input;
                                            switch (block.name) {
                                                case 'Write':
                                                case 'Read':
                                                case 'Edit':
                                                case 'NotebookEdit':
                                                    detail.input = input.file_path || '';
                                                    break;
                                                case 'Bash':
                                                    detail.input = (input.command || '').substring(0, 120);
                                                    break;
                                                case 'Agent':
                                                    detail.input = input.description || input.prompt || '';
                                                    break;
                                                case 'Grep':
                                                    const pattern = input.pattern || '';
                                                    const path = input.path || '';
                                                    detail.input = path ? `${pattern} in ${path}` : pattern;
                                                    break;
                                                case 'Glob':
                                                    detail.input = input.pattern || '';
                                                    break;
                                                case 'WebFetch':
                                                case 'WebSearch':
                                                    detail.input = input.url || input.query || '';
                                                    break;
                                                default:
                                                    detail.input = JSON.stringify(input).substring(0, 100);
                                            }
                                        }
                                        toolDetails.push(detail);
                                    }
                                }
                            }
                        }
                        turns.push({
                            role: 'assistant',
                            text: text.substring(0, 10000),
                            timestamp: entry.timestamp || new Date().toISOString(),
                            model: entry.message?.model,
                            toolCalls,
                            toolDetails,
                            usage: usage ? {
                                inputTokens: usage.input_tokens || 0,
                                outputTokens: usage.output_tokens || 0,
                                cacheReadInputTokens: usage.cache_read_input_tokens,
                                cacheCreationInputTokens: usage.cache_creation_input_tokens
                            } : undefined
                        });
                    }
                }
                catch (err) {
                    // Skip malformed lines
                }
            });
            lineReader.on('close', () => {
                resolve(turns);
            });
            lineReader.on('error', () => {
                resolve([]);
            });
        });
    }
    /**
     * Retrieves sessions from Claude Code's session storage
     * @returns Promise resolving to array of Session objects
     */
    async getSessions() {
        try {
            const home = os_1.default.homedir();
            const projectsDir = path_1.default.join(home, '.claude', 'projects');
            if (!await this.dirExists(projectsDir)) {
                return [];
            }
            // Find all .jsonl files under projectsDir
            const files = await this.findJsonlFiles(projectsDir);
            const sessions = [];
            for (const file of files) {
                try {
                    const session = await this.parseSessionFile(file);
                    if (session) {
                        sessions.push(session);
                    }
                }
                catch (err) {
                    console.error(`Error parsing session file ${file}:`, err);
                }
            }
            // Sort by end time (most recent first)
            sessions.sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
            return sessions;
        }
        catch (err) {
            console.error('ClaudeCodeAdapter error:', err);
            return [];
        }
    }
    /**
     * Recursively find all .jsonl files in a directory
     */
    async findJsonlFiles(dir) {
        const files = [];
        try {
            const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...await this.findJsonlFiles(fullPath));
                }
                else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
                    files.push(fullPath);
                }
            }
        }
        catch (err) {
            // Directory doesn't exist or can't be read
        }
        return files;
    }
    /**
     * Parse a JSONL session file with advanced data extraction
     */
    async parseSessionFile(filePath) {
        return new Promise((resolve) => {
            const session = {
                id: path_1.default.basename(filePath, '.jsonl'),
                source: 'claude-code',
                project_dir: this.decodeProjectDir(path_1.default.dirname(filePath)),
                model: 'claude-3-5-sonnet-20241022',
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                user_turns: 0,
                assist_turns: 0,
                total_usage: {
                    input_tokens: 0,
                    output_tokens: 0,
                    cache_read_input_tokens: 0,
                    cache_creation_input_tokens: 0
                },
                tool_counts: {},
                first_prompt: '',
                file_path: filePath
            };
            const entries = [];
            let firstUser = true;
            const lineReader = (0, readline_1.createInterface)({
                input: (0, fs_1.createReadStream)(filePath),
                crlfDelay: Infinity
            });
            lineReader.on('line', (line) => {
                try {
                    const entry = JSON.parse(line);
                    entries.push(entry);
                }
                catch (err) {
                    // Skip malformed lines
                }
            });
            lineReader.on('close', () => {
                // Post-process entries to extract detailed metrics
                const conversationPairs = this.processEntries(entries, session, firstUser);
                // Store conversation pairs on the session object for later retrieval
                session._conversation_pairs = conversationPairs;
                resolve(session);
            });
            lineReader.on('error', (err) => {
                console.error(`Error reading file ${filePath}:`, err);
                resolve(null);
            });
        });
    }
    /**
     * Process parsed entries to extract metrics and build conversation data
     */
    processEntries(entries, session, firstUserRef) {
        let firstUser = firstUserRef;
        let lastGitBranch = '';
        const ctx = {
            lastUserIndex: -1,
            conversationPairs: [],
            tools: new Map()
        };
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            // Update time range
            if (entry.timestamp) {
                const ts = new Date(entry.timestamp);
                if (!session.start_time || ts < new Date(session.start_time)) {
                    session.start_time = entry.timestamp;
                }
                if (!session.end_time || ts > new Date(session.end_time)) {
                    session.end_time = entry.timestamp;
                }
            }
            // Track git branch
            if (entry.gitBranch) {
                lastGitBranch = entry.gitBranch;
                if (!session.git_branch) {
                    session.git_branch = entry.gitBranch;
                }
            }
            if (entry.type === 'user') {
                session.user_turns++;
                ctx.lastUserEntry = entry;
                ctx.lastUserIndex = i;
                // Extract first user prompt
                if (firstUser && entry.message?.content) {
                    let textContent = null;
                    if (typeof entry.message.content === 'string') {
                        session.first_prompt = entry.message.content.substring(0, 120);
                        firstUser = false;
                    }
                    else if (Array.isArray(entry.message.content)) {
                        textContent = entry.message.content.find((c) => c.type === 'text');
                        if (textContent?.text) {
                            session.first_prompt = textContent.text.substring(0, 120);
                            firstUser = false;
                        }
                    }
                }
            }
            else if (entry.type === 'assistant') {
                session.assist_turns++;
                // Update model if available
                if (entry.message?.model) {
                    session.model = entry.message.model;
                }
                // Extract token usage
                if (entry.message?.usage) {
                    const usage = entry.message.usage;
                    session.total_usage.input_tokens += usage.input_tokens || 0;
                    session.total_usage.output_tokens += usage.output_tokens || 0;
                    if (usage.cache_read_input_tokens) {
                        session.total_usage.cache_read_input_tokens = (session.total_usage.cache_read_input_tokens || 0) + usage.cache_read_input_tokens;
                    }
                    if (usage.cache_creation_input_tokens) {
                        session.total_usage.cache_creation_input_tokens = (session.total_usage.cache_creation_input_tokens || 0) + usage.cache_creation_input_tokens;
                    }
                }
                // Extract tool usage and build conversation pair if we have a prior user message
                const toolDetails = [];
                if (entry.message?.content && Array.isArray(entry.message.content)) {
                    for (const block of entry.message.content) {
                        if (block.type === 'tool_use') {
                            const toolName = block.name || block.tool;
                            if (toolName) {
                                if (!session.tool_counts)
                                    session.tool_counts = {};
                                session.tool_counts[toolName] = (session.tool_counts[toolName] || 0) + 1;
                                // Collect tool sample
                                if (block.input && typeof block.input === 'object') {
                                    const inputStr = JSON.stringify(block.input).substring(0, 100);
                                    if (!ctx.tools.has(toolName)) {
                                        ctx.tools.set(toolName, []);
                                    }
                                    const samples = ctx.tools.get(toolName);
                                    if (samples.length < 5 && !samples.includes(inputStr)) {
                                        samples.push(inputStr);
                                    }
                                }
                                // Build tool detail
                                toolDetails.push({
                                    tool: toolName,
                                    input: block.input ? JSON.stringify(block.input).substring(0, 100) : undefined
                                });
                            }
                        }
                    }
                }
                // Match user-assistant pair if we have a prior user message
                if (ctx.lastUserEntry) {
                    const pair = this.buildConversationPair(session, ctx.lastUserEntry, entry, toolDetails, entry.timestamp);
                    ctx.conversationPairs.push(pair);
                }
            }
        }
        // Store tool samples in session
        if (ctx.tools.size > 0) {
            session.tool_samples = {};
            for (const [toolName, samples] of ctx.tools) {
                session.tool_samples[toolName] = samples;
            }
        }
        return ctx.conversationPairs;
    }
    /**
     * Build a conversation pair from user and assistant entries
     */
    buildConversationPair(session, userEntry, assistantEntry, toolDetails, timestamp) {
        // Extract user text
        let userText = '';
        if (userEntry.message?.content) {
            if (typeof userEntry.message.content === 'string') {
                userText = userEntry.message.content;
            }
            else if (Array.isArray(userEntry.message.content)) {
                const textBlock = userEntry.message.content.find((c) => c.type === 'text');
                userText = textBlock?.text || '';
            }
        }
        // Extract assistant text
        let assistText = '';
        if (assistantEntry.message?.content) {
            if (typeof assistantEntry.message.content === 'string') {
                assistText = assistantEntry.message.content;
            }
            else if (Array.isArray(assistantEntry.message.content)) {
                const textBlock = assistantEntry.message.content.find((c) => c.type === 'text');
                assistText = textBlock?.text || '';
            }
        }
        // Calculate cost based on tokens
        let cost = 0;
        if (assistantEntry.message?.usage) {
            const usage = assistantEntry.message.usage;
            const inputCost = ((usage.input_tokens || 0) / 1000000) * 0.003;
            const outputCost = ((usage.output_tokens || 0) / 1000000) * 0.015;
            cost = inputCost + outputCost;
        }
        // Calculate prompt score (1-10 scale based on various factors)
        const promptScore = this.calculatePromptScore(userText, toolDetails.length > 0);
        // Build the pair
        const pair = {
            session_id: session.id,
            project_dir: session.project_dir,
            git_branch: session.git_branch,
            model: session.model,
            user_text: userText.substring(0, 1000),
            assist_text: assistText.substring(0, 1000),
            tool_calls: toolDetails.map(t => t.tool),
            tool_details: toolDetails.length > 0 ? toolDetails : undefined,
            usage: assistantEntry.message?.usage ? {
                input_tokens: assistantEntry.message.usage.input_tokens || 0,
                output_tokens: assistantEntry.message.usage.output_tokens || 0,
                cache_read_input_tokens: assistantEntry.message.usage.cache_read_input_tokens,
                cache_creation_input_tokens: assistantEntry.message.usage.cache_creation_input_tokens
            } : undefined,
            timestamp: timestamp || assistantEntry.timestamp || new Date().toISOString(),
            duration_ms: undefined,
            context_pct: undefined,
            cost,
            prompt_score: promptScore,
            prompt_tips: this.generatePromptTips(userText, assistText, toolDetails.length > 0)
        };
        return pair;
    }
    /**
     * Calculate a prompt quality score (1-10)
     */
    calculatePromptScore(userText, usedTools) {
        let score = 7; // Base score
        // Length check - too short or too long is bad
        if (userText.length < 10) {
            score -= 2;
        }
        else if (userText.length > 5000) {
            score -= 1;
        }
        else if (userText.length > 500) {
            score += 1; // Detailed prompts tend to be better
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
        // Check for domain knowledge indicators
        if (/\b(function|class|async|import|export|const|let|var)\b/i.test(userText)) {
            score += 1;
        }
        return Math.max(1, Math.min(10, Math.round(score)));
    }
    /**
     * Generate helpful tips for improving prompts
     */
    generatePromptTips(userText, assistText, usedTools) {
        const tips = [];
        if (userText.length < 20) {
            tips.push('Try providing more context and details in your prompts');
        }
        if (!usedTools && assistText.length > 0) {
            tips.push('Consider asking the AI to use tools for more actionable results');
        }
        if (/\?$/.test(userText)) {
            tips.push('Phrase prompts as specific requests rather than questions');
        }
        if (userText.toLowerCase().includes('todo') || userText.toLowerCase().includes('please')) {
            tips.push('Be direct and explicit about what you want');
        }
        return tips.length > 0 ? tips : ['Great prompt! Keep being specific and detailed.'];
    }
    /**
     * Decode project directory from the session file path
     */
    decodeProjectDir(dir) {
        // Path structure: ~/.claude/projects/PROJECT_NAME/SESSION_ID/...
        const parts = dir.split(path_1.default.sep);
        const projectsIndex = parts.indexOf('projects');
        if (projectsIndex !== -1 && projectsIndex + 1 < parts.length) {
            // Decode URL-encoded project name
            const encoded = parts[projectsIndex + 1];
            try {
                // Replace hyphens with slashes for path reconstruction
                return decodeURIComponent(encoded).replace(/-/g, '/');
            }
            catch {
                return encoded;
            }
        }
        return dir;
    }
    /**
     * Checks if a directory exists
     */
    async dirExists(dir) {
        try {
            await promises_1.default.access(dir);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.ClaudeCodeAdapter = ClaudeCodeAdapter;
