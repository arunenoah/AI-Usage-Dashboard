import express, { Express } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { createHandler } from './api/handlers';
import { Store } from './store/store';
import { Watcher } from './watcher/watcher';
import { WebSocketHub } from './ws/hub';

const app: Express = express();
const port = process.env.PORT || 8765;

// Initialize core components
const store = new Store();
const hub = new WebSocketHub();
const handler = createHandler(store);

// Middleware
app.use(express.json());

// Serve static files (web/dist)
// __dirname is backends/nodejs/dist, so go up 3 levels to project root
const distPath = path.resolve(__dirname, '../../../web/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  console.warn(`Warning: web/dist not found at ${distPath}`);
}

// API Routes
handler.register(app);

// Create HTTP server for WebSocket support
const server = http.createServer(app);

server.listen(port, async () => {
  console.log(`ai-sessions running -> http://localhost:${port}`);

  // Load initial sessions
  try {
    await store.loadAll();
    console.log(`✓ Loaded ${store.sessions().length} sessions`);
  } catch (err) {
    console.warn('Initial load warning:', err);
  }

  // Start file watcher
  try {
    const watcher = new Watcher(store, hub);
    await watcher.start();
    console.log('✓ File watcher started');
  } catch (err) {
    console.warn('Watcher warning:', err);
  }
});

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    hub.handleUpgrade(request, socket, head);
  } else {
    socket.destroy();
  }
});

export default app;
