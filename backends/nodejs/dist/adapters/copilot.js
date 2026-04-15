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
            let firstUser = true;
            const lineReader = (0, readline_1.createInterface)({
                input: (0, fs_1.createReadStream)(filePath),
                crlfDelay: Infinity
            });
            lineReader.on('line', (line) => {
                try {
                    const entry = JSON.parse(line);
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
                        if (firstUser && entry.message?.text) {
                            session.first_prompt = entry.message.text.substring(0, 120);
                            firstUser = false;
                        }
                    }
                    else if (entry.type === 'assistant') {
                        session.assist_turns++;
                        if (entry.message?.usage) {
                            const usage = entry.message.usage;
                            session.total_usage.input_tokens += usage.input_tokens || 0;
                            session.total_usage.output_tokens += usage.output_tokens || 0;
                        }
                    }
                }
                catch (err) {
                    // Skip malformed lines
                }
            });
            lineReader.on('close', () => {
                resolve(session);
            });
            lineReader.on('error', () => {
                resolve(null);
            });
        });
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
