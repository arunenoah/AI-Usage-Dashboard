import { WebSocket, Server as WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';

export class WebSocketHub {
  private clients: Set<WebSocket> = new Set();
  private wss: WebSocketServer;

  constructor() {
    // Create WebSocketServer once, reuse for all connections
    this.wss = new WebSocketServer({ noServer: true });
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      this.addClient(ws);
      ws.on('close', () => this.removeClient(ws));
      ws.on('error', (err: Error) => console.error('WebSocket error:', err));
      // Send initial connection message
      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to server' }));
    });
  }

  private addClient(ws: WebSocket): void {
    this.clients.add(ws);
    console.log(`WebSocket client connected. Total: ${this.clients.size}`);
  }

  private removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
    console.log(`WebSocket client disconnected. Total: ${this.clients.size}`);
  }

  broadcast(data: unknown): void {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
