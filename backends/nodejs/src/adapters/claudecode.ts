import { Session } from '../types/models';
import { IAdapter } from './adapter';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * Adapter for Claude Code sessions
 *
 * Loads sessions from Claude Code's project directory at ~/.claude/projects
 */
export class ClaudeCodeAdapter implements IAdapter {
  /**
   * Retrieves sessions from Claude Code's session storage
   * @returns Promise resolving to array of Session objects
   */
  async getSessions(): Promise<Session[]> {
    try {
      const home = os.homedir();
      const projectsDir = path.join(home, '.claude', 'projects');

      if (!await this.dirExists(projectsDir)) {
        return [];
      }

      // TODO: Parse session files from projectsDir
      // For now, return empty array
      return [];
    } catch (err) {
      console.error('ClaudeCodeAdapter error:', err);
      return [];
    }
  }

  /**
   * Checks if a directory exists
   * @param dir Directory path to check
   * @returns Promise resolving to true if directory exists, false otherwise
   */
  private async dirExists(dir: string): Promise<boolean> {
    try {
      await fs.access(dir);
      return true;
    } catch {
      return false;
    }
  }
}
