"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Watcher = void 0;
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
/**
 * File system watcher for monitoring session file changes
 *
 * Monitors three key directories:
 * - ~/.claude/projects (Claude Code sessions)
 * - VS Code workspace storage (GitHub Copilot sessions)
 * - Windsurf directory (Windsurf IDE sessions)
 *
 * When files change, triggers store reload and broadcasts update via WebSocket
 */
class Watcher {
    constructor(store, hub) {
        this.store = store;
        this.hub = hub;
        this.watcher = null;
    }
    /**
     * Starts monitoring the file system
     * Watches multiple directory locations with cross-platform path resolution
     */
    async start() {
        const home = os_1.default.homedir();
        const watchDirs = [
            path_1.default.join(home, '.claude', 'projects'),
            this.getVSCodeWorkspaceDir(home),
            this.getWindsurfDir(home)
        ];
        this.watcher = chokidar_1.default.watch(watchDirs, {
            ignored: /(^|[/\\])\.|node_modules/,
            persistent: true,
            ignoreInitial: true
        });
        this.watcher
            .on('add', () => this.onFileChange())
            .on('change', () => this.onFileChange())
            .on('unlink', () => this.onFileChange());
        console.log('Watcher started for:', watchDirs);
    }
    /**
     * Handles file changes by reloading store and broadcasting update
     * Catches and logs errors to prevent watcher from crashing
     */
    async onFileChange() {
        try {
            await this.store.loadAll();
            this.hub.broadcast({ type: 'reload', data: { sessions: this.store.sessions() } });
        }
        catch (err) {
            console.error('Watcher reload error:', err);
        }
    }
    /**
     * Resolves VS Code workspace storage directory for current platform
     * @param home User's home directory
     * @returns Platform-specific path to VS Code workspace storage
     */
    getVSCodeWorkspaceDir(home) {
        const platform = process.platform;
        if (platform === 'win32') {
            const appdata = process.env.APPDATA || path_1.default.join(home, 'AppData', 'Roaming');
            return path_1.default.join(appdata, 'Code', 'User', 'workspaceStorage');
        }
        else if (platform === 'darwin') {
            return path_1.default.join(home, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
        }
        else {
            const configDir = process.env.XDG_CONFIG_HOME || path_1.default.join(home, '.config');
            return path_1.default.join(configDir, 'Code', 'User', 'workspaceStorage');
        }
    }
    /**
     * Resolves Windsurf IDE directory for current platform
     * @param home User's home directory
     * @returns Platform-specific path to Windsurf configuration
     */
    getWindsurfDir(home) {
        const platform = process.platform;
        if (platform === 'win32') {
            const appdata = process.env.APPDATA || path_1.default.join(home, 'AppData', 'Roaming');
            return path_1.default.join(appdata, 'Codeium', 'windsurf');
        }
        else if (platform === 'darwin') {
            return path_1.default.join(home, 'Library', 'Application Support', 'Codeium', 'windsurf');
        }
        else {
            const configDir = process.env.XDG_CONFIG_HOME || path_1.default.join(home, '.config');
            return path_1.default.join(configDir, 'Codeium', 'windsurf');
        }
    }
    /**
     * Stops the file system watcher gracefully
     */
    stop() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}
exports.Watcher = Watcher;
