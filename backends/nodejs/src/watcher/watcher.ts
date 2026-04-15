import chokidar from 'chokidar';
import path from 'path';
import os from 'os';
import { Store } from '../store/store';
import { WebSocketHub } from '../ws/hub';

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
export class Watcher {
  private watcher: chokidar.FSWatcher | null = null;

  constructor(private store: Store, private hub: WebSocketHub) {}

  /**
   * Starts monitoring the file system
   * Watches multiple directory locations with cross-platform path resolution
   */
  async start(): Promise<void> {
    const home = os.homedir();
    const watchDirs = [
      path.join(home, '.claude', 'projects'),
      this.getVSCodeWorkspaceDir(home),
      this.getWindsurfDir(home)
    ];

    this.watcher = chokidar.watch(watchDirs, {
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
  private async onFileChange(): Promise<void> {
    try {
      await this.store.loadAll();
      this.hub.broadcast({ type: 'reload', data: { sessions: this.store.sessions() } });
    } catch (err) {
      console.error('Watcher reload error:', err);
    }
  }

  /**
   * Resolves VS Code workspace storage directory for current platform
   * @param home User's home directory
   * @returns Platform-specific path to VS Code workspace storage
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

  /**
   * Resolves Windsurf IDE directory for current platform
   * @param home User's home directory
   * @returns Platform-specific path to Windsurf configuration
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

  /**
   * Stops the file system watcher gracefully
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
