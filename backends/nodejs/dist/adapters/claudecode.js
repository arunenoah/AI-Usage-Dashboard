"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeAdapter = void 0;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
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
            // TODO: Parse session files from projectsDir
            // For now, return empty array
            return [];
        }
        catch (err) {
            console.error('ClaudeCodeAdapter error:', err);
            return [];
        }
    }
    /**
     * Checks if a directory exists
     * @param dir Directory path to check
     * @returns Promise resolving to true if directory exists, false otherwise
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
