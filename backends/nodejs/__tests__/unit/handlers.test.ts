import request from 'supertest';
import express from 'express';
import { createHandler } from '../../src/api/handlers';
import { Store } from '../../src/store/store';
import { Session } from '../../src/types/models';

describe('API Handlers', () => {
  let app: express.Express;
  let store: Store;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    store = new Store();
    const handler = createHandler(store);
    handler.register(app);
  });

  describe('GET /api/health', () => {
    test('should return 200 with status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/stats', () => {
    test('should return stats with daily and summary', async () => {
      const res = await request(app).get('/api/stats?days=7');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('daily');
      expect(res.body).toHaveProperty('summary');
      expect(Array.isArray(res.body.daily)).toBe(true);
    });

    test('should accept from and to query parameters', async () => {
      const res = await request(app).get('/api/stats?from=2024-01-01&to=2024-01-31');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('daily');
      expect(res.body).toHaveProperty('summary');
    });

    test('should default to 7 days if days parameter not provided', async () => {
      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('daily');
    });
  });

  describe('GET /api/sessions', () => {
    test('should return sessions array', async () => {
      const res = await request(app).get('/api/sessions');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
    });

    test('should support pagination with page and limit', async () => {
      // Add test sessions
      const testSession: Session = {
        id: 'test-1',
        project_dir: '/test/project1',
        model: 'claude-3-5-sonnet-20241022',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        user_turns: 5,
        assist_turns: 5,
        total_usage: { input_tokens: 1000, output_tokens: 500 },
        source: 'claude-code'
      };
      store.addSession(testSession);

      const res = await request(app).get('/api/sessions?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
    });

    test('should filter by project', async () => {
      const res = await request(app).get('/api/sessions?project=test');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
    });

    test('should reject invalid limit', async () => {
      const res = await request(app).get('/api/sessions?limit=6000');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('should reject negative limit', async () => {
      const res = await request(app).get('/api/sessions?limit=-1');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/sessions/:id', () => {
    test('should return session detail', async () => {
      const testSession: Session = {
        id: 'test-session-123',
        project_dir: '/test/project',
        model: 'claude-3-5-sonnet-20241022',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        user_turns: 3,
        assist_turns: 3,
        total_usage: { input_tokens: 1000, output_tokens: 500 },
        source: 'claude-code'
      };
      store.addSession(testSession);

      const res = await request(app).get('/api/sessions/test-session-123');
      expect(res.status).toBe(200);
      expect(res.body.session.id).toBe('test-session-123');
      expect(res.body.session.project_dir).toBe('/test/project');
      expect(Array.isArray(res.body.turns)).toBe(true);
    });

    test('should return 404 for non-existent session', async () => {
      const res = await request(app).get('/api/sessions/non-existent');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/tools/:sessionId', () => {
    test('should return tools for session', async () => {
      const res = await request(app).get('/api/tools/test-session-123');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tools');
      expect(Array.isArray(res.body.tools)).toBe(true);
    });
  });

  describe('GET /api/system', () => {
    test('should return system info', async () => {
      const res = await request(app).get('/api/system');
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });
  });

  describe('GET /api/history', () => {
    test('should return history array', async () => {
      const res = await request(app).get('/api/history');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('entries');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.entries)).toBe(true);
    });
  });

  describe('GET /api/conversations', () => {
    test('should return conversations array', async () => {
      const res = await request(app).get('/api/conversations');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/insights', () => {
    test('should return insights object', async () => {
      const res = await request(app).get('/api/insights');
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });
  });

  describe('GET /api/image', () => {
    test('should return 404', async () => {
      const res = await request(app).get('/api/image');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tasks', () => {
    test('should return tasks array', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/copilot/stats', () => {
    test('should return copilot stats', async () => {
      const res = await request(app).get('/api/copilot/stats');
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });
  });

  describe('GET /api/copilot/sessions', () => {
    test('should return copilot sessions', async () => {
      const res = await request(app).get('/api/copilot/sessions');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
    });
  });

  describe('GET /api/copilot/sessions/:id', () => {
    test('should return 404 for copilot session detail', async () => {
      const res = await request(app).get('/api/copilot/sessions/test-id');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
});
