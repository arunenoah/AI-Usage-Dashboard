"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotAdapter = void 0;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
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
            const workspaceStorageDir = this.getVSCodeWorkspaceDir(home);
            // TODO: Parse VS Code workspace storage for Copilot sessions
            return [];
        }
        catch (err) {
            console.error('CopilotAdapter error:', err);
            return [];
        }
    }
    /**
     * Gets the VS Code workspace storage directory for the current platform
     * @param home User's home directory
     * @returns Path to VS Code workspace storage directory
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
}
exports.CopilotAdapter = CopilotAdapter;
