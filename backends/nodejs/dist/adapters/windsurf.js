"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindsurfAdapter = void 0;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
/**
 * Adapter for Windsurf sessions
 *
 * Loads sessions from Windsurf's configuration directory which varies by platform
 */
class WindsurfAdapter {
    /**
     * Retrieves sessions from Windsurf's session storage
     * @returns Promise resolving to array of Session objects
     */
    async getSessions() {
        try {
            const home = os_1.default.homedir();
            const windsurfDir = this.getWindsurfDir(home);
            // TODO: Parse Windsurf session files
            return [];
        }
        catch (err) {
            console.error('WindsurfAdapter error:', err);
            return [];
        }
    }
    /**
     * Gets the Windsurf configuration directory for the current platform
     * @param home User's home directory
     * @returns Path to Windsurf directory
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
}
exports.WindsurfAdapter = WindsurfAdapter;
