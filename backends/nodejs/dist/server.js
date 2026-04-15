"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const handlers_1 = require("./api/handlers");
const store_1 = require("./store/store");
const watcher_1 = require("./watcher/watcher");
const hub_1 = require("./ws/hub");
const app = (0, express_1.default)();
const port = process.env.PORT || 8765;
// Initialize core components
const store = new store_1.Store();
const hub = new hub_1.WebSocketHub();
const handler = (0, handlers_1.createHandler)(store);
// Middleware
app.use(express_1.default.json());
// Serve static files (web/dist)
// __dirname is backends/nodejs/dist, so go up 3 levels to project root
const distPath = path_1.default.resolve(__dirname, '../../../web/dist');
if (fs_1.default.existsSync(distPath)) {
    app.use(express_1.default.static(distPath));
}
else {
    console.warn(`Warning: web/dist not found at ${distPath}`);
}
// API Routes
handler.register(app);
// Create HTTP server for WebSocket support
const server = http_1.default.createServer(app);
server.listen(port, async () => {
    console.log(`ai-sessions running -> http://localhost:${port}`);
    // Load initial sessions
    try {
        await store.loadAll();
        console.log(`✓ Loaded ${store.sessions().length} sessions`);
    }
    catch (err) {
        console.warn('Initial load warning:', err);
    }
    // Start file watcher
    try {
        const watcher = new watcher_1.Watcher(store, hub);
        await watcher.start();
        console.log('✓ File watcher started');
    }
    catch (err) {
        console.warn('Watcher warning:', err);
    }
});
// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
        hub.handleUpgrade(request, socket, head);
    }
    else {
        socket.destroy();
    }
});
exports.default = app;
