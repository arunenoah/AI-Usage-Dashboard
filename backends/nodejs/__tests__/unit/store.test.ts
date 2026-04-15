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
      // Go-compatible: top-level fields, no summary wrapper
      expect(stats).toHaveProperty('total_sessions');
      expect(stats).toHaveProperty('total_input_tokens');
      expect(stats).toHaveProperty('total_cost_usd');
    });

    test('should return only days with sessions (no empty-day pre-fill)', () => {
      // With no sessions, daily is empty — matches Go computeStats behavior
      const stats1 = store.statsForDays(1);
      expect(Array.isArray(stats1.daily)).toBe(true);
      expect(stats1.daily.length).toBe(0);
    });

    test('should calculate daily stats with empty sessions', () => {
      // With no sessions, total_sessions = 0 and daily = []
      const stats = store.statsForDays(1);
      expect(stats.total_sessions).toBe(0);
      expect(stats.total_input_tokens).toBe(0);
      expect(stats.total_output_tokens).toBe(0);
      expect(stats.total_cost_usd).toBe(0);
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

      // Go-compatible: top-level fields
      expect(stats.total_sessions).toBe(1);
      expect(stats.total_input_tokens).toBe(1000);
      expect(stats.total_output_tokens).toBe(500);
      // Cost: (1000/1e6 * 3.0) + (500/1e6 * 15.0) = 0.0105, rounded to 2dp = 0.01
      expect(stats.total_cost_usd).toBeGreaterThan(0);
      expect(stats.total_cost_usd).toBeCloseTo(0.0105, 1);
    });

    test('should have proper date format in daily stats when sessions exist', () => {
      const now = new Date();
      store.addSession({
        id: 'fmt-test',
        project_dir: '/p',
        source: 'claude-code',
        start_time: now.toISOString(),
        end_time: now.toISOString(),
        model: 'claude-3',
        user_turns: 1,
        assist_turns: 1,
        total_usage: { input_tokens: 100, output_tokens: 50 },
      });
      const stats = store.statsForDays(1);
      expect(stats.daily.length).toBeGreaterThan(0);
      expect(stats.daily[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should order days ascending (oldest first) when sessions exist', () => {
      // Go sorts daily ascending by date
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      store.addSession({
        id: 'day-today',
        project_dir: '/p',
        source: 'claude-code',
        start_time: now.toISOString(),
        end_time: now.toISOString(),
        model: 'claude-3',
        user_turns: 1,
        assist_turns: 1,
        total_usage: { input_tokens: 100, output_tokens: 50 },
      });
      store.addSession({
        id: 'day-yesterday',
        project_dir: '/p',
        source: 'claude-code',
        start_time: yesterday.toISOString(),
        end_time: yesterday.toISOString(),
        model: 'claude-3',
        user_turns: 1,
        assist_turns: 1,
        total_usage: { input_tokens: 100, output_tokens: 50 },
      });

      const stats = store.statsForDays(7);
      // daily is sorted ascending; yesterday < today
      expect(stats.daily.length).toBe(2);
      expect(stats.daily[0].date < stats.daily[1].date).toBe(true);
    });
  });

  describe('statsForRange', () => {
    test('should calculate stats for date range', () => {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const stats = store.statsForRange(weekAgo, today);

      expect(Array.isArray(stats.daily)).toBe(true);
      // daily only includes days with sessions — may be empty with no test sessions
      expect(stats).toHaveProperty('total_sessions');
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

      // Go-compatible: top-level field
      expect(stats.total_sessions).toBe(1);
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
