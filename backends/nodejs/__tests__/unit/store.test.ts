import { Store } from '../../src/store/store';
import { Session, DailyStats } from '../../src/types/models';

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('initialization', () => {
    test('should initialize with empty sessions', () => {
      expect(store.sessions()).toHaveLength(0);
    });
  });

  describe('addSession', () => {
    test('should add a single session', () => {
      const session: Session = {
        id: 'test-1',
        project_dir: '/home/user/project',
        source: 'claude-code',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 5,
        assist_turns: 5,
        total_usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      store.addSession(session);
      expect(store.sessions()).toHaveLength(1);
      expect(store.sessions()[0].id).toBe('test-1');
    });

    test('should add multiple sessions', () => {
      const session1: Session = {
        id: 'test-1',
        project_dir: '/home/user/project1',
        source: 'claude-code',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 5,
        assist_turns: 5,
        total_usage: { input_tokens: 1000, output_tokens: 500 }
      };

      const session2: Session = {
        id: 'test-2',
        project_dir: '/home/user/project2',
        source: 'github-copilot',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 3,
        assist_turns: 3,
        total_usage: { input_tokens: 500, output_tokens: 250 }
      };

      store.addSession(session1);
      store.addSession(session2);

      expect(store.sessions()).toHaveLength(2);
    });
  });

  describe('sessionsBySource', () => {
    beforeEach(() => {
      store.addSession({
        id: 'test-1',
        project_dir: '/home/user/project1',
        source: 'claude-code',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 5,
        assist_turns: 5,
        total_usage: { input_tokens: 1000, output_tokens: 500 }
      });

      store.addSession({
        id: 'test-2',
        project_dir: '/home/user/project2',
        source: 'github-copilot',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 3,
        assist_turns: 3,
        total_usage: { input_tokens: 500, output_tokens: 250 }
      });

      store.addSession({
        id: 'test-3',
        project_dir: '/home/user/project3',
        source: 'opencode',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 2,
        assist_turns: 2,
        total_usage: { input_tokens: 200, output_tokens: 100 }
      });
    });

    test('should filter sessions by claude-code source', () => {
      const filtered = store.sessionsBySource('claude-code');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('test-1');
      expect(filtered[0].source).toBe('claude-code');
    });

    test('should filter sessions by github-copilot source', () => {
      const filtered = store.sessionsBySource('github-copilot');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('test-2');
    });

    test('should filter sessions by opencode source', () => {
      const filtered = store.sessionsBySource('opencode');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('test-3');
    });

    test('should return empty array for non-existent source', () => {
      const filtered = store.sessionsBySource('windsurf');
      expect(filtered).toHaveLength(0);
      expect(Array.isArray(filtered)).toBe(true);
    });
  });

  describe('statsForDays', () => {
    test('should return stats structure for days', () => {
      const stats = store.statsForDays(1);
      expect(stats).toBeDefined();
      expect(Array.isArray(stats.daily)).toBe(true);
      expect(stats.summary).toBeDefined();
    });

    test('should return correct number of days', () => {
      const stats1 = store.statsForDays(1);
      expect(stats1.daily).toHaveLength(1);

      const stats7 = store.statsForDays(7);
      expect(stats7.daily).toHaveLength(7);

      const stats30 = store.statsForDays(30);
      expect(stats30.daily).toHaveLength(30);
    });

    test('should calculate daily stats with empty sessions', () => {
      const stats = store.statsForDays(1);
      const today = stats.daily[0];

      expect(today.sessions).toBe(0);
      expect(today.input_tokens).toBe(0);
      expect(today.output_tokens).toBe(0);
      expect(today.est_cost_usd).toBe(0);
    });

    test('should aggregate sessions for today', () => {
      const now = new Date();
      const startTime = now.toISOString();
      const endTime = new Date(now.getTime() + 3600000).toISOString();

      store.addSession({
        id: 'test-1',
        project_dir: '/home/user/project1',
        source: 'claude-code',
        start_time: startTime,
        end_time: endTime,
        model: 'claude-3-5-sonnet',
        user_turns: 5,
        assist_turns: 5,
        total_usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      });

      store.addSession({
        id: 'test-2',
        project_dir: '/home/user/project2',
        source: 'github-copilot',
        start_time: startTime,
        end_time: endTime,
        model: 'claude-3-5-sonnet',
        user_turns: 3,
        assist_turns: 3,
        total_usage: {
          input_tokens: 500,
          output_tokens: 250
        }
      });

      const stats = store.statsForDays(1);
      const today = stats.daily[0];

      expect(today.sessions).toBe(2);
      expect(today.input_tokens).toBe(1500);
      expect(today.output_tokens).toBe(750);
    });

    test('should return summary with totals', () => {
      const now = new Date();
      const startTime = now.toISOString();
      const endTime = new Date(now.getTime() + 3600000).toISOString();

      store.addSession({
        id: 'test-1',
        project_dir: '/home/user/project1',
        source: 'claude-code',
        start_time: startTime,
        end_time: endTime,
        model: 'claude-3-5-sonnet',
        user_turns: 5,
        assist_turns: 5,
        total_usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      });

      const stats = store.statsForDays(1);

      expect(stats.summary.totalSessions).toBe(1);
      expect(stats.summary.totalTokens).toBe(1500);
      // Cost is calculated from token usage, so it should be greater than 0
      expect(stats.summary.totalCost).toBeGreaterThan(0);
      expect(stats.summary.totalCost).toBeLessThan(0.001); // Less than $0.001
    });

    test('should have proper date format in daily stats', () => {
      const stats = store.statsForDays(1);
      const today = stats.daily[0];

      expect(today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should order days from today backwards', () => {
      const stats = store.statsForDays(3);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(today);
      dayBefore.setDate(dayBefore.getDate() - 2);

      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const dayBeforeStr = dayBefore.toISOString().split('T')[0];

      expect(stats.daily[0].date).toBe(todayStr);
      expect(stats.daily[1].date).toBe(yesterdayStr);
      expect(stats.daily[2].date).toBe(dayBeforeStr);
    });
  });

  describe('statsForRange', () => {
    test('should calculate stats for date range', () => {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const stats = store.statsForRange(weekAgo, today);

      expect(Array.isArray(stats.daily)).toBe(true);
      expect(stats.daily.length).toBeGreaterThanOrEqual(7);
    });

    test('should aggregate sessions within date range', () => {
      const today = new Date();
      const startTime = today.toISOString();
      const endTime = new Date(today.getTime() + 3600000).toISOString();

      store.addSession({
        id: 'test-1',
        project_dir: '/home/user/project1',
        source: 'claude-code',
        start_time: startTime,
        end_time: endTime,
        model: 'claude-3-5-sonnet',
        user_turns: 5,
        assist_turns: 5,
        total_usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      });

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const stats = store.statsForRange(weekAgo, today);

      expect(stats.summary.totalSessions).toBe(1);
    });
  });

  describe('sessions isolation', () => {
    test('should return copy of sessions array', () => {
      const session: Session = {
        id: 'test-1',
        project_dir: '/home/user/project',
        source: 'claude-code',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 5,
        assist_turns: 5,
        total_usage: { input_tokens: 1000, output_tokens: 500 }
      };

      store.addSession(session);
      const sessions1 = store.sessions();
      const sessions2 = store.sessions();

      expect(sessions1).not.toBe(sessions2);
      expect(sessions1).toEqual(sessions2);
    });

    test('should prevent external modification of sessions', () => {
      const session: Session = {
        id: 'test-1',
        project_dir: '/home/user/project',
        source: 'claude-code',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 5,
        assist_turns: 5,
        total_usage: { input_tokens: 1000, output_tokens: 500 }
      };

      store.addSession(session);
      const sessions = store.sessions();

      // This should not affect the store
      (sessions as any).push({
        id: 'test-2',
        project_dir: '/home/user/project2',
        source: 'github-copilot',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        model: 'claude-3-5-sonnet',
        user_turns: 3,
        assist_turns: 3,
        total_usage: { input_tokens: 500, output_tokens: 250 }
      });

      expect(store.sessions()).toHaveLength(1);
    });
  });

  describe('loadAll', () => {
    test('should provide loadAll method', async () => {
      expect(typeof store.loadAll).toBe('function');
      expect(store.loadAll()).toBeInstanceOf(Promise);
    });

    test('should handle loadAll without error', async () => {
      await expect(store.loadAll()).resolves.not.toThrow();
    });
  });
});
