import { Session } from '../types/models';
import { IAdapter } from './adapter';
import path from 'path';
import os from 'os';

/**
 * Adapter for Windsurf sessions
 *
 * Loads sessions from Windsurf's configuration directory which varies by platform
 */
export class WindsurfAdapter implements IAdapter {
  /**
   * Retrieves sessions from Windsurf's session storage
   * @returns Promise resolving to array of Session objects
   */
  async getSessions(): Promise<Session[]> {
    try {
      const home = os.homedir();
      const windsurfDir = this.getWindsurfDir(home);

      // TODO: Parse Windsurf session files
      return [];
    } catch (err) {
      console.error('WindsurfAdapter error:', err);
      return [];
    }
  }

  /**
   * Gets the Windsurf configuration directory for the current platform
   * @param home User's home directory
   * @returns Path to Windsurf directory
   */
  private getWindsurfDir(home: string): string {
    const platform = process.platform;
    if (platform === 'win32') {
      const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appdata, 'Codeium', 'windsurf');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Codeium', 'windsurf');
    } else {
      const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      return path.join(configDir, 'Codeium', 'windsurf');
    }
  }
}
