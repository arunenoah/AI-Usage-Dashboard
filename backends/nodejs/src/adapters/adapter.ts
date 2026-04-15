import { Session } from '../types/models';

/**
 * Interface for session adapters
 *
 * All adapters must implement this interface to provide sessions
 * from different sources (claude-code, github-copilot, opencode, windsurf)
 */
export interface IAdapter {
  /**
   * Retrieves sessions from the adapter's source
   * @returns Promise resolving to array of Session objects
   */
  getSessions(): Promise<Session[]>;
}
