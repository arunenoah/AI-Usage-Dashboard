"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketHub = void 0;
const ws_1 = require("ws");
class WebSocketHub {
    constructor() {
        this.clients = new Set();
        // Create WebSocketServer once, reuse for all connections
        this.wss = new ws_1.Server({ noServer: true });
    }
    handleUpgrade(request, socket, head) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.addClient(ws);
            ws.on('close', () => this.removeClient(ws));
            ws.on('error', (err) => console.error('WebSocket error:', err));
            // Send initial connection message
            ws.send(JSON.stringify({ type: 'connected', message: 'Connected to server' }));
        });
    }
    addClient(ws) {
        this.clients.add(ws);
        console.log(`WebSocket client connected. Total: ${this.clients.size}`);
    }
    removeClient(ws) {
        this.clients.delete(ws);
        console.log(`WebSocket client disconnected. Total: ${this.clients.size}`);
    }
    broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}
exports.WebSocketHub = WebSocketHub;
