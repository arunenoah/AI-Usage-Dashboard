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
 */
class ClaudeCodeAdapter {
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
     * Parse a JSONL session file
     */
    async parseSessionFile(filePath) {
        return new Promise((resolve) => {
            const session = {
                id: path_1.default.basename(filePath, '.jsonl'),
                source: 'claude-code',
                project_dir: this.decodeProjectDir(path_1.default.dirname(filePath)),
                model: 'claude-3.5-sonnet',
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
                        if (new Date(session.start_time).getTime() === new Date().getTime() || ts < new Date(session.start_time)) {
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
                        if (entry.message?.model) {
                            session.model = entry.message.model;
                        }
                        if (entry.message?.usage) {
                            const usage = entry.message.usage;
                            session.total_usage.input_tokens += usage.input_tokens || 0;
                            session.total_usage.output_tokens += usage.output_tokens || 0;
                        }
                    }
                    // Count tool usage
                    if (entry.message?.tool_uses) {
                        for (const tool of entry.message.tool_uses) {
                            if (tool.name && session.tool_counts) {
                                session.tool_counts[tool.name] = (session.tool_counts[tool.name] || 0) + 1;
                            }
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
            lineReader.on('error', (err) => {
                console.error(`Error reading file ${filePath}:`, err);
                resolve(null);
            });
        });
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
