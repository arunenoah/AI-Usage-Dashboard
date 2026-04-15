"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotAdapter = void 0;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const readline_1 = require("readline");
/**
 * Adapter for GitHub Copilot sessions
 *
 * Loads sessions from VS Code's workspace storage directory which contains
 * Copilot extension data across all workspaces
 */
class CopilotAdapter {
    /**
     * Retrieves sessions from GitHub Copilot's storage
     * @returns Promise resolving to array of Session objects
     */
    async getSessions() {
        try {
            const home = os_1.default.homedir();
            const userDirs = this.getVSCodeUserDirs(home);
            const sessions = [];
            for (const userDir of userDirs) {
                const wsRoot = path_1.default.join(userDir, 'workspaceStorage');
                try {
                    await promises_1.default.access(wsRoot);
                    const files = await this.findCopilotSessions(wsRoot);
                    for (const file of files) {
                        try {
                            const session = await this.parseSessionFile(file);
                            if (session) {
                                sessions.push(session);
                            }
                        }
                        catch (err) {
                            // Skip malformed files
                        }
                    }
                }
                catch {
                    // Directory doesn't exist
                }
            }
            sessions.sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
            return sessions;
        }
        catch (err) {
            console.error('CopilotAdapter error:', err);
            return [];
        }
    }
    /**
     * Find all Copilot Chat JSONL files
     */
    async findCopilotSessions(wsRoot) {
        const files = [];
        try {
            const entries = await promises_1.default.readdir(wsRoot, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                const hashDir = path_1.default.join(wsRoot, entry.name);
                const chatDir = path_1.default.join(hashDir, 'chatSessions');
                try {
                    const chatEntries = await promises_1.default.readdir(chatDir, { withFileTypes: true });
                    for (const chatEntry of chatEntries) {
                        if (chatEntry.isFile() && chatEntry.name.endsWith('.jsonl')) {
                            files.push(path_1.default.join(chatDir, chatEntry.name));
                        }
                    }
                }
                catch {
                    // chatSessions directory doesn't exist
                }
            }
        }
        catch {
            // workspaceStorage doesn't exist
        }
        return files;
    }
    /**
     * Parse a Copilot Chat JSONL file
     */
    async parseSessionFile(filePath) {
        return new Promise((resolve) => {
            const session = {
                id: path_1.default.basename(filePath, '.jsonl'),
                source: 'github-copilot',
                project_dir: '',
                model: 'gpt-4o',
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
                first_prompt: ''
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
                // Process entries to extract metrics
                const conversationPairs = this.processEntries(entries, session, firstUser);
                session._conversation_pairs = conversationPairs;
                resolve(session);
            });
            lineReader.on('error', () => {
                resolve(null);
            });
        });
    }
    /**
     * Process entries to extract conversation pairs and metrics
     */
    processEntries(entries, session, firstUserRef) {
        let firstUser = firstUserRef;
        let lastUserEntry;
        const conversationPairs = [];
        const tools = new Map();
        for (const entry of entries) {
            if (entry.timestamp) {
                const ts = new Date(entry.timestamp);
                if (session.start_time === new Date().toISOString() || ts < new Date(session.start_time)) {
                    session.start_time = entry.timestamp;
                }
                if (ts > new Date(session.end_time)) {
                    session.end_time = entry.timestamp;
                }
            }
            if (entry.type === 'user') {
                session.user_turns++;
                lastUserEntry = entry;
                if (firstUser) {
                    if (entry.message?.text) {
                        session.first_prompt = entry.message.text.substring(0, 120);
                        firstUser = false;
                    }
                    else if (typeof entry.message?.content === 'string') {
                        session.first_prompt = entry.message.content.substring(0, 120);
                        firstUser = false;
                    }
                }
            }
            else if (entry.type === 'assistant') {
                session.assist_turns++;
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
                // Build conversation pair
                if (lastUserEntry) {
                    const toolDetails = [];
                    if (entry.message?.content && Array.isArray(entry.message.content)) {
                        for (const block of entry.message.content) {
                            if (block.type === 'tool_use' && block.name) {
                                if (!session.tool_counts)
                                    session.tool_counts = {};
                                session.tool_counts[block.name] = (session.tool_counts[block.name] || 0) + 1;
                                toolDetails.push({
                                    tool: block.name,
                                    input: block.input ? JSON.stringify(block.input).substring(0, 100) : undefined
                                });
                            }
                        }
                    }
                    const pair = this.buildConversationPair(session, lastUserEntry, entry, toolDetails, entry.timestamp);
                    conversationPairs.push(pair);
                }
            }
        }
        // Store tool samples
        if (tools.size > 0) {
            session.tool_samples = {};
            for (const [toolName, samples] of tools) {
                session.tool_samples[toolName] = samples;
            }
        }
        return conversationPairs;
    }
    /**
     * Build a conversation pair from user and assistant entries
     */
    buildConversationPair(session, userEntry, assistantEntry, toolDetails, timestamp) {
        let userText = '';
        if (userEntry.message?.text) {
            userText = userEntry.message.text;
        }
        else if (typeof userEntry.message?.content === 'string') {
            userText = userEntry.message.content;
        }
        else if (Array.isArray(userEntry.message?.content)) {
            const textBlock = userEntry.message.content.find((c) => c.type === 'text');
            userText = textBlock?.text || '';
        }
        let assistText = '';
        if (assistantEntry.message?.text) {
            assistText = assistantEntry.message.text;
        }
        else if (typeof assistantEntry.message?.content === 'string') {
            assistText = assistantEntry.message.content;
        }
        else if (Array.isArray(assistantEntry.message?.content)) {
            const textBlock = assistantEntry.message.content.find((c) => c.type === 'text');
            assistText = textBlock?.text || '';
        }
        let cost = 0;
        if (assistantEntry.message?.usage) {
            const usage = assistantEntry.message.usage;
            const inputCost = ((usage.input_tokens || 0) / 1000000) * 0.003;
            const outputCost = ((usage.output_tokens || 0) / 1000000) * 0.015;
            cost = inputCost + outputCost;
        }
        const promptScore = this.calculatePromptScore(userText, toolDetails.length > 0);
        return {
            session_id: session.id,
            project_dir: session.project_dir,
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
            cost,
            prompt_score: promptScore,
            prompt_tips: this.generatePromptTips(userText, assistText, toolDetails.length > 0)
        };
    }
    /**
     * Calculate prompt score
     */
    calculatePromptScore(userText, usedTools) {
        let score = 7;
        if (userText.length < 10) {
            score -= 2;
        }
        else if (userText.length > 5000) {
            score -= 1;
        }
        else if (userText.length > 500) {
            score += 1;
        }
        if (/\b(specific|exact|particular|example|test|code|file)\b/i.test(userText)) {
            score += 1;
        }
        if (usedTools) {
            score += 1;
        }
        return Math.max(1, Math.min(10, Math.round(score)));
    }
    /**
     * Generate prompt tips
     */
    generatePromptTips(userText, assistText, usedTools) {
        const tips = [];
        if (userText.length < 20) {
            tips.push('Try providing more context and details in your prompts');
        }
        if (!usedTools && assistText.length > 0) {
            tips.push('Consider asking the AI to use tools for more actionable results');
        }
        return tips.length > 0 ? tips : ['Great prompt! Keep being specific and detailed.'];
    }
    /**
     * Gets VS Code User directories for all platforms
     */
    getVSCodeUserDirs(home) {
        const platform = process.platform;
        if (platform === 'win32') {
            const appdata = process.env.APPDATA || path_1.default.join(home, 'AppData', 'Roaming');
            return [
                path_1.default.join(appdata, 'Code', 'User'),
                path_1.default.join(appdata, 'Code - Insiders', 'User')
            ];
        }
        else if (platform === 'darwin') {
            return [
                path_1.default.join(home, 'Library', 'Application Support', 'Code', 'User'),
                path_1.default.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User')
            ];
        }
        else {
            const configDir = process.env.XDG_CONFIG_HOME || path_1.default.join(home, '.config');
            return [
                path_1.default.join(configDir, 'Code', 'User'),
                path_1.default.join(configDir, 'Code - Insiders', 'User')
            ];
        }
    }
}
exports.CopilotAdapter = CopilotAdapter;
