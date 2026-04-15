import { Session } from '../types/models';
import { IAdapter } from './adapter';
import path from 'path';
import os from 'os';

/**
 * Adapter for GitHub Copilot sessions
 *
 * Loads sessions from VS Code's workspace storage directory which contains
 * Copilot extension data across all workspaces
 */
export class CopilotAdapter implements IAdapter {
  /**
   * Retrieves sessions from GitHub Copilot's storage
   * @returns Promise resolving to array of Session objects
   */
  async getSessions(): Promise<Session[]> {
    try {
      const home = os.homedir();
      const workspaceStorageDir = this.getVSCodeWorkspaceDir(home);

      // TODO: Parse VS Code workspace storage for Copilot sessions
      return [];
    } catch (err) {
      console.error('CopilotAdapter error:', err);
      return [];
    }
  }

  /**
   * Gets the VS Code workspace storage directory for the current platform
   * @param home User's home directory
   * @returns Path to VS Code workspace storage directory
   */
  private getVSCodeWorkspaceDir(home: string): string {
    const platform = process.platform;
    if (platform === 'win32') {
      const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appdata, 'Code', 'User', 'workspaceStorage');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
    } else {
      const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      return path.join(configDir, 'Code', 'User', 'workspaceStorage');
    }
  }
}
