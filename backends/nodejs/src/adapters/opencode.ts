import { Session } from '../types/models';
import { IAdapter } from './adapter';

/**
 * Adapter for OpenCode sessions
 *
 * Loads sessions from OpenCode's session storage
 */
export class OpenCodeAdapter implements IAdapter {
  /**
   * Retrieves sessions from OpenCode
   * @returns Promise resolving to array of Session objects
   */
  async getSessions(): Promise<Session[]> {
    // TODO: Implement OpenCode session parsing
    return [];
  }
}
