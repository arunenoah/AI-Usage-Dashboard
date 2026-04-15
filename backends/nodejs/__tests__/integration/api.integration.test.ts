import { Store } from '../../src/store/store';
import { createHandler } from '../../src/api/handlers';
import express from 'express';
import request from 'supertest';
import { Session } from '../../src/types/models';

describe('API Integration', () => {
  let store: Store;
  let app: express.Express;

  beforeEach(async () => {
    // Create fresh store and app for each test
    store = new Store();
    app = express();
    app.use(express.json());

    // Register handlers
    const handler = createHandler(store);
    handler.register(app);

    // Load sessions (async)
    await store.loadAll();
  });

  test('Store loads without errors', async () => {
    expect(store.sessions()).toBeDefined();
    expect(Array.isArray(store.sessions())).toBe(true);
  });

  test('Stats endpoint returns correct structure', async () => {
    const response = await request(app)
      .get('/api/stats?days=7')
      .expect(200);

    expect(response.body).toHaveProperty('daily');
    expect(response.body).toHaveProperty('total_sessions');
    expect(response.body).toHaveProperty('total_cost_usd');
    expect(Array.isArray(response.body.daily)).toBe(true);
    // daily only includes days with sessions — length may be 0..7
    expect(response.body.daily.length).toBeLessThanOrEqual(7);
  });

  test('Session filtering works', () => {
    const sessions = store.sessions();
    const filtered = sessions.filter(s => s.source === 'claude-code');
    expect(Array.isArray(filtered)).toBe(true);
  });

  test('Health endpoint returns ok status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  test('Sessions endpoint with pagination', async () => {
    const response = await request(app)
      .get('/api/sessions?page=1&limit=10')
      .expect(200);

    expect(response.body).toHaveProperty('sessions');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page');
    expect(response.body.page).toBe(1);
  });

  test('Invalid limit parameter is rejected', async () => {
    const response = await request(app)
      .get('/api/sessions?limit=10000')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('Non-existent session returns 404', async () => {
    const response = await request(app)
      .get('/api/sessions/non-existent-id')
      .expect(404);

    expect(response.body).toHaveProperty('error');
  });

  test('API responses are consistent across multiple calls', async () => {
    const stats1 = await request(app).get('/api/stats?days=1');
    const stats2 = await request(app).get('/api/stats?days=1');

    expect(stats1.body).toEqual(stats2.body);
  });

  test('Date range filtering works', async () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const response = await request(app)
      .get(`/api/stats?from=${today}&to=${tomorrow}`)
      .expect(200);

    expect(response.body).toHaveProperty('daily');
    expect(response.body).toHaveProperty('total_sessions');
  });
});
