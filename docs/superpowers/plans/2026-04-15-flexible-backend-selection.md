# Flexible Backend Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement flexible backend selection allowing users to choose between Go or NodeJS, with identical API, shared frontend, and zero impact on existing Go implementation.

**Architecture:** Create `/backends/nodejs/` mirroring Go structure (adapters, api, store, watcher, ws), define data models in JSON Schema, generate types for both languages, add setup/start scripts that read `backend.config.json` to install/run chosen backend.

**Tech Stack:** NodeJS/TypeScript, Express.js, Chokidar (file watcher), ws (WebSocket), Jest (testing)

---

## Phase 1: Infrastructure Setup

### Task 1: Create Backend Directory Structure

**Files:**
- Create: `backends/nodejs/` directory tree
- Create: `schemas/` directory
- Create: `scripts/` directory (if not exists)

- [ ] **Step 1: Create NodeJS backend directories**

```bash
mkdir -p backends/nodejs/src/{adapters,api,store,watcher,ws,types}
mkdir -p backends/nodejs/__tests__/{unit,integration,fixtures}
mkdir -p schemas
mkdir -p scripts
```

- [ ] **Step 2: Verify structure**

```bash
tree backends/nodejs -L 3
# Expected: src/ with subdirectories, __tests__/, package.json (will create)
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: create nodejs backend directory structure"
```

---

### Task 2: Create backend.config.json Template and Validation

**Files:**
- Create: `backend.config.json` (user-created, template in docs)
- Modify: `package.json` (root)

- [ ] **Step 1: Create backend.config.json example in project root**

```json
{
  "backend": "nodejs",
  "port": 8765
}
```

- [ ] **Step 2: Add backend.config.json to .gitignore (user-specific)**

```bash
echo "backend.config.json" >> .gitignore
```

- [ ] **Step 3: Create backend.config.example.json in docs for reference**

```bash
cat > backend.config.example.json << 'EOF'
{
  "backend": "nodejs",
  "port": 8765
}
EOF
```

Instructions in this file:
```text
Rename this to backend.config.json and edit to choose your backend:
- "backend": "go" or "nodejs"
- "port": port number (default 8765)
```

- [ ] **Step 4: Commit**

```bash
git add backend.config.example.json .gitignore
git commit -m "chore: add backend configuration template"
```

---

## Phase 2: Data Models & Type Generation

### Task 3: Create JSON Schema for Data Models

**Files:**
- Create: `schemas/models.schema.json`

- [ ] **Step 1: Read existing Go models to understand structure**

```bash
head -200 backends/go/internal/models/models.go
# Review: ConversationPair, DailyStats, Session, ModelStats, etc.
```

- [ ] **Step 2: Create comprehensive JSON Schema**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Sessions Data Models",
  "definitions": {
    "ConversationPair": {
      "type": "object",
      "properties": {
        "userPrompt": { "type": "string" },
        "assistantResponse": { "type": "string" },
        "model": { "type": "string" },
        "inputTokens": { "type": "integer" },
        "outputTokens": { "type": "integer" },
        "cost": { "type": "number" }
      },
      "required": ["userPrompt", "assistantResponse", "model"]
    },
    "DailyStats": {
      "type": "object",
      "properties": {
        "date": { "type": "string", "format": "date" },
        "sessions": { "type": "integer" },
        "totalInputTokens": { "type": "integer" },
        "totalOutputTokens": { "type": "integer" },
        "totalCost": { "type": "number" },
        "averagePromptLength": { "type": "number" }
      },
      "required": ["date"]
    },
    "Session": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "projectDir": { "type": "string" },
        "source": { "enum": ["claude-code", "github-copilot", "opencode", "windsurf"] },
        "startTime": { "type": "integer" },
        "endTime": { "type": "integer" },
        "conversations": { "type": "array", "items": { "$ref": "#/definitions/ConversationPair" } },
        "metadata": { "type": "object" }
      },
      "required": ["id", "projectDir", "source", "startTime"]
    },
    "ModelStats": {
      "type": "object",
      "properties": {
        "model": { "type": "string" },
        "usageCount": { "type": "integer" },
        "totalTokens": { "type": "integer" },
        "totalCost": { "type": "number" },
        "percentage": { "type": "number" }
      },
      "required": ["model", "usageCount"]
    },
    "ToolUsage": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "count": { "type": "integer" },
        "example": { "type": "string" }
      },
      "required": ["name", "count"]
    }
  }
}
```

Save to `schemas/models.schema.json`

- [ ] **Step 3: Validate schema syntax**

```bash
node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('schemas/models.schema.json', 'utf8'))))" > /dev/null && echo "✓ Valid JSON"
```

- [ ] **Step 4: Commit**

```bash
git add schemas/models.schema.json
git commit -m "chore: create JSON schema for data models"
```

---

### Task 4: Create Type Generation Scripts

**Files:**
- Create: `scripts/gen-node-types.sh`
- Create: `backends/nodejs/src/types/models.ts` (will be generated, but scaffold structure)

- [ ] **Step 1: Install json-schema-to-typescript (dev dependency in root)**

```bash
npm install --save-dev json-schema-to-typescript
```

- [ ] **Step 2: Create Node type generation script**

File: `scripts/gen-node-types.sh`

```bash
#!/bin/bash
set -e

echo "Generating TypeScript types from JSON Schema..."
npx json-schema-to-typescript \
  schemas/models.schema.json \
  --output backends/nodejs/src/types/models.ts \
  --top-level-ref "#/definitions"

echo "✓ TypeScript types generated at backends/nodejs/src/types/models.ts"
```

Make executable:
```bash
chmod +x scripts/gen-node-types.sh
```

- [ ] **Step 3: Create Go type generation script (placeholder for now)**

File: `scripts/gen-go-types.sh`

```bash
#!/bin/bash
set -e

echo "Go types are manually maintained in backends/go/internal/models/models.go"
echo "When updating schemas/models.schema.json, ensure Go models match."
```

Make executable:
```bash
chmod +x scripts/gen-go-types.sh
```

- [ ] **Step 4: Verify json-schema-to-typescript is available**

```bash
npx json-schema-to-typescript --version
```

Expected: Shows version number

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-node-types.sh scripts/gen-go-types.sh package.json package-lock.json
git commit -m "chore: add type generation scripts"
```

---

### Task 5: Generate Initial TypeScript Types

**Files:**
- Create: `backends/nodejs/src/types/models.ts` (generated)

- [ ] **Step 1: Run type generation script**

```bash
scripts/gen-node-types.sh
```

- [ ] **Step 2: Verify generated file exists and contains types**

```bash
head -50 backends/nodejs/src/types/models.ts
# Expected: TypeScript interface definitions for ConversationPair, DailyStats, Session, etc.
```

- [ ] **Step 3: Verify TypeScript syntax is valid**

```bash
# Will verify when we set up TypeScript compiler in next task
cat backends/nodejs/src/types/models.ts | grep "export interface" | head -5
# Expected: Multiple interface exports
```

- [ ] **Step 4: Commit generated types**

```bash
git add backends/nodejs/src/types/models.ts
git commit -m "chore: generate typescript type definitions from schema"
```

---

## Phase 3: NodeJS Backend Setup

### Task 6: Create NodeJS Backend package.json and Build Configuration

**Files:**
- Create: `backends/nodejs/package.json`
- Create: `backends/nodejs/tsconfig.json`
- Create: `backends/nodejs/jest.config.js`

- [ ] **Step 1: Create package.json**

File: `backends/nodejs/package.json`

```json
{
  "name": "ai-sessions-nodejs",
  "version": "1.0.0",
  "description": "AI Sessions analytics dashboard - NodeJS backend",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/server.ts",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "express": "^4.18.0",
    "chokidar": "^3.5.0",
    "ws": "^8.13.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

File: `backends/nodejs/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create jest.config.js**

File: `backends/nodejs/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**'
  ]
};
```

- [ ] **Step 4: Commit**

```bash
git add backends/nodejs/package.json backends/nodejs/tsconfig.json backends/nodejs/jest.config.js
git commit -m "chore: setup nodejs backend build and test configuration"
```

---

### Task 7: Install NodeJS Backend Dependencies

**Files:**
- Modify: `backends/nodejs/package.json` (via npm install)

- [ ] **Step 1: Install dependencies**

```bash
cd backends/nodejs
npm install
cd ../..
```

Expected: Creates `node_modules/`, `package-lock.json`

- [ ] **Step 2: Verify installation**

```bash
test -d backends/nodejs/node_modules && echo "✓ Dependencies installed"
```

- [ ] **Step 3: Commit lock file**

```bash
git add backends/nodejs/package-lock.json
git commit -m "chore: npm dependencies lock file"
```

---

## Phase 4: Core Backend Modules

### Task 8: Create Express Server Entry Point

**Files:**
- Create: `backends/nodejs/src/server.ts`

- [ ] **Step 1: Create minimal Express server**

File: `backends/nodejs/src/server.ts`

```typescript
import express, { Express } from 'express';
import path from 'path';
import fs from 'fs';
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

// API Routes (to be registered by handler)
handler.register(app);

// WebSocket upgrade handler
const server = app.listen(port, async () => {
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
```

- [ ] **Step 2: Commit**

```bash
git add backends/nodejs/src/server.ts
git commit -m "feat: create express server entry point"
```

---

### Task 9: Implement Store (Session Storage)

**Files:**
- Create: `backends/nodejs/src/store/store.ts`
- Create: `backends/nodejs/__tests__/unit/store.test.ts`

- [ ] **Step 1: Write failing test for Store**

File: `backends/nodejs/__tests__/unit/store.test.ts`

```typescript
import { Store } from '../../src/store/store';
import { Session } from '../../src/types/models';

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  test('should initialize with empty sessions', () => {
    expect(store.sessions()).toHaveLength(0);
  });

  test('should add session', () => {
    const session: Session = {
      id: 'test-1',
      projectDir: '/home/user/project',
      source: 'claude-code',
      startTime: Date.now(),
      conversations: []
    };
    store.addSession(session);
    expect(store.sessions()).toHaveLength(1);
    expect(store.sessions()[0].id).toBe('test-1');
  });

  test('should filter sessions by source', () => {
    store.addSession({
      id: 'test-1',
      projectDir: '/home/user/project1',
      source: 'claude-code',
      startTime: Date.now(),
      conversations: []
    });
    store.addSession({
      id: 'test-2',
      projectDir: '/home/user/project2',
      source: 'github-copilot',
      startTime: Date.now(),
      conversations: []
    });
    
    const copilotSessions = store.sessionsBySource('github-copilot');
    expect(copilotSessions).toHaveLength(1);
    expect(copilotSessions[0].id).toBe('test-2');
  });

  test('should get stats for days', () => {
    // Stats calculation tested separately
    const stats = store.statsForDays(1);
    expect(stats).toBeDefined();
    expect(Array.isArray(stats.daily)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backends/nodejs
npm test -- __tests__/unit/store.test.ts
cd ../..
```

Expected: FAIL - Store class not found

- [ ] **Step 3: Implement Store class**

File: `backends/nodejs/src/store/store.ts`

```typescript
import { Session, DailyStats } from '../types/models';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export class Store {
  private sessions: Session[] = [];

  sessions(): Session[] {
    return [...this.sessions];
  }

  addSession(session: Session): void {
    this.sessions.push(session);
  }

  sessionsBySource(source: string): Session[] {
    return this.sessions.filter(s => s.source === source);
  }

  async loadAll(): Promise<void> {
    // Load sessions from adapter sources
    // This will be implemented when adapters are ready
    this.sessions = [];
  }

  statsForDays(days: number): { daily: DailyStats[], summary: any } {
    const result: DailyStats[] = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Aggregate stats for this day
      const dailyStats: DailyStats = {
        date: dateStr,
        sessions: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0
      };
      
      // Calculate from this.sessions filtered by date
      const daySessions = this.sessions.filter(s => {
        const sDate = new Date(s.startTime).toISOString().split('T')[0];
        return sDate === dateStr;
      });
      
      dailyStats.sessions = daySessions.length;
      daySessions.forEach(session => {
        session.conversations.forEach(conv => {
          dailyStats.totalInputTokens += conv.inputTokens || 0;
          dailyStats.totalOutputTokens += conv.outputTokens || 0;
          dailyStats.totalCost += conv.cost || 0;
        });
      });
      
      result.push(dailyStats);
    }
    
    return {
      daily: result,
      summary: {
        totalSessions: this.sessions.length,
        totalTokens: result.reduce((sum, d) => sum + d.totalInputTokens + d.totalOutputTokens, 0),
        totalCost: result.reduce((sum, d) => sum + d.totalCost, 0)
      }
    };
  }

  statsForRange(from: Date, to: Date): { daily: DailyStats[], summary: any } {
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return this.statsForDays(days);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backends/nodejs
npm test -- __tests__/unit/store.test.ts
cd ../..
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backends/nodejs/src/store/store.ts backends/nodejs/__tests__/unit/store.test.ts
git commit -m "feat: implement session store with tests"
```

---

### Task 10: Implement API Handlers

**Files:**
- Create: `backends/nodejs/src/api/handlers.ts`
- Create: `backends/nodejs/__tests__/unit/handlers.test.ts`

- [ ] **Step 1: Write test for API handler creation**

File: `backends/nodejs/__tests__/unit/handlers.test.ts`

```typescript
import request from 'supertest';
import express from 'express';
import { createHandler } from '../../src/api/handlers';
import { Store } from '../../src/store/store';

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

  test('GET /api/health should return 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /api/stats should return stats', async () => {
    const res = await request(app).get('/api/stats?days=7');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('daily');
    expect(res.body).toHaveProperty('summary');
  });

  test('GET /api/sessions should return sessions', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });
});
```

- [ ] **Step 2: Install test dependency (supertest)**

```bash
cd backends/nodejs
npm install --save-dev supertest @types/supertest
cd ../..
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backends/nodejs
npm test -- __tests__/unit/handlers.test.ts
cd ../..
```

Expected: FAIL - createHandler not found

- [ ] **Step 4: Implement API handlers**

File: `backends/nodejs/src/api/handlers.ts`

```typescript
import { Express, Request, Response } from 'express';
import { Store } from '../store/store';

export class Handler {
  constructor(private store: Store) {}

  register(app: Express): void {
    app.get('/api/health', (req, res) => this.health(req, res));
    app.get('/api/stats', (req, res) => this.getStats(req, res));
    app.get('/api/sessions', (req, res) => this.getSessions(req, res));
    app.get('/api/sessions/:id', (req, res) => this.getSessionDetail(req, res));
    app.get('/api/tools/:sessionId', (req, res) => this.getToolSamples(req, res));
    app.get('/api/system', (req, res) => this.getSystemInfo(req, res));
    app.get('/api/history', (req, res) => this.getHistory(req, res));
    app.get('/api/conversations', (req, res) => this.getConversations(req, res));
    app.get('/api/insights', (req, res) => this.getInsights(req, res));
    app.get('/api/image', (req, res) => this.serveImage(req, res));
    app.get('/api/tasks', (req, res) => this.getTasks(req, res));
    app.get('/api/copilot/stats', (req, res) => this.getCopilotStats(req, res));
    app.get('/api/copilot/sessions', (req, res) => this.getCopilotSessions(req, res));
    app.get('/api/copilot/sessions/:id', (req, res) => this.getCopilotSessionDetail(req, res));
  }

  private health(req: Request, res: Response): void {
    res.json({ status: 'ok' });
  }

  private getStats(req: Request, res: Response): void {
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;
    const days = parseInt(req.query.days as string) || 7;

    if (fromStr || toStr) {
      const from = fromStr ? new Date(fromStr) : new Date();
      const to = toStr ? new Date(toStr) : new Date();
      res.json(this.store.statsForRange(from, to));
    } else {
      res.json(this.store.statsForDays(days));
    }
  }

  private getSessions(req: Request, res: Response): void {
    let sessions = this.store.sessions();
    
    const project = req.query.project as string;
    if (project) {
      sessions = sessions.filter(s => s.projectDir.includes(project));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (limit < 1 || limit > 5000) {
      res.status(400).json({ error: 'limit must be between 1 and 5000' });
      return;
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    
    res.json({
      sessions: sessions.slice(start, end),
      total: sessions.length,
      page
    });
  }

  private getSessionDetail(req: Request, res: Response): void {
    const id = req.params.id;
    const session = this.store.sessions().find(s => s.id === id);
    
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    
    res.json(session);
  }

  private getToolSamples(req: Request, res: Response): void {
    // TODO: Implement tool samples
    res.json({ tools: [] });
  }

  private getSystemInfo(req: Request, res: Response): void {
    // TODO: Implement system info
    res.json({});
  }

  private getHistory(req: Request, res: Response): void {
    // TODO: Implement history
    res.json([]);
  }

  private getConversations(req: Request, res: Response): void {
    // TODO: Implement conversations
    res.json([]);
  }

  private getInsights(req: Request, res: Response): void {
    // TODO: Implement insights
    res.json({});
  }

  private serveImage(req: Request, res: Response): void {
    res.status(404).send('not found');
  }

  private getTasks(req: Request, res: Response): void {
    // TODO: Implement tasks
    res.json([]);
  }

  private getCopilotStats(req: Request, res: Response): void {
    // TODO: Implement copilot stats
    res.json({});
  }

  private getCopilotSessions(req: Request, res: Response): void {
    // TODO: Implement copilot sessions
    res.json({ sessions: [] });
  }

  private getCopilotSessionDetail(req: Request, res: Response): void {
    res.status(404).json({ error: 'not implemented' });
  }
}

export function createHandler(store: Store): Handler {
  return new Handler(store);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backends/nodejs
npm test -- __tests__/unit/handlers.test.ts
cd ../..
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backends/nodejs/src/api/handlers.ts backends/nodejs/__tests__/unit/handlers.test.ts
git commit -m "feat: implement API handlers with tests"
```

---

### Task 11: Implement File System Watcher

**Files:**
- Create: `backends/nodejs/src/watcher/watcher.ts`

- [ ] **Step 1: Create Watcher class**

File: `backends/nodejs/src/watcher/watcher.ts`

```typescript
import chokidar from 'chokidar';
import path from 'path';
import os from 'os';
import { Store } from '../store/store';
import { WebSocketHub } from '../ws/hub';

export class Watcher {
  private watcher: chokidar.FSWatcher | null = null;

  constructor(private store: Store, private hub: WebSocketHub) {}

  async start(): Promise<void> {
    const home = os.homedir();
    const watchDirs = [
      path.join(home, '.claude', 'projects'),
      this.getVSCodeWorkspaceDir(home),
      this.getWindsurfDir(home)
    ];

    this.watcher = chokidar.watch(watchDirs, {
      ignored: /(^|[/\\])\.|node_modules/,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', () => this.onFileChange())
      .on('change', () => this.onFileChange())
      .on('unlink', () => this.onFileChange());

    console.log('Watcher started for:', watchDirs);
  }

  private async onFileChange(): Promise<void> {
    try {
      await this.store.loadAll();
      this.hub.broadcast({ type: 'reload', data: { sessions: this.store.sessions() } });
    } catch (err) {
      console.error('Watcher reload error:', err);
    }
  }

  private getVSCodeWorkspaceDir(home: string): string {
    const platform = process.platform;
    if (platform === 'win32') {
      const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appdata, 'Code', 'User', 'workspaceStorage');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
    } else {
      const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      return path.join(configDir, 'Code', 'User', 'workspaceStorage');
    }
  }

  private getWindsurfDir(home: string): string {
    const platform = process.platform;
    if (platform === 'win32') {
      const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appdata, 'Codeium', 'windsurf');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Codeium', 'windsurf');
    } else {
      const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      return path.join(configDir, 'Codeium', 'windsurf');
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
```

- [ ] **Step 2: Verify syntax**

```bash
cd backends/nodejs
npm run build
cd ../..
```

Expected: Successfully compiles

- [ ] **Step 3: Commit**

```bash
git add backends/nodejs/src/watcher/watcher.ts
git commit -m "feat: implement file system watcher with chokidar"
```

---

### Task 12: Implement WebSocket Hub

**Files:**
- Create: `backends/nodejs/src/ws/hub.ts`

- [ ] **Step 1: Create WebSocket Hub class**

File: `backends/nodejs/src/ws/hub.ts`

```typescript
import { WebSocket, Server as WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';

export class WebSocketHub {
  private clients: Set<WebSocket> = new Set();

  handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer): void {
    const wss = new WebSocketServer({ noServer: true });
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      this.addClient(ws);
      ws.on('close', () => this.removeClient(ws));
      ws.on('error', (err) => console.error('WebSocket error:', err));
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

  broadcast(data: any): void {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
```

- [ ] **Step 2: Update server.ts to use WebSocketHub properly**

Edit `backends/nodejs/src/server.ts` to import and use WebSocketHub:

```typescript
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
const distPath = path.join(__dirname, '../../web/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
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
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd backends/nodejs
npm run build
cd ../..
```

Expected: Successfully compiles

- [ ] **Step 4: Commit**

```bash
git add backends/nodejs/src/ws/hub.ts backends/nodejs/src/server.ts
git commit -m "feat: implement websocket hub for real-time updates"
```

---

### Task 13: Implement Session Adapters (Stub)

**Files:**
- Create: `backends/nodejs/src/adapters/adapter.ts` (base interface)
- Create: `backends/nodejs/src/adapters/claudecode.ts`
- Create: `backends/nodejs/src/adapters/copilot.ts`
- Create: `backends/nodejs/src/adapters/opencode.ts`
- Create: `backends/nodejs/src/adapters/windsurf.ts`

- [ ] **Step 1: Create base adapter interface**

File: `backends/nodejs/src/adapters/adapter.ts`

```typescript
import { Session } from '../types/models';

export interface IAdapter {
  getSessions(): Promise<Session[]>;
}
```

- [ ] **Step 2: Create claudecode adapter (stub)**

File: `backends/nodejs/src/adapters/claudecode.ts`

```typescript
import { Session } from '../types/models';
import { IAdapter } from './adapter';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export class ClaudeCodeAdapter implements IAdapter {
  async getSessions(): Promise<Session[]> {
    try {
      const home = os.homedir();
      const projectsDir = path.join(home, '.claude', 'projects');
      
      if (!await this.dirExists(projectsDir)) {
        return [];
      }

      // TODO: Parse session files from projectsDir
      // For now, return empty array
      return [];
    } catch (err) {
      console.error('ClaudeCodeAdapter error:', err);
      return [];
    }
  }

  private async dirExists(dir: string): Promise<boolean> {
    try {
      await fs.access(dir);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 3: Create copilot adapter (stub)**

File: `backends/nodejs/src/adapters/copilot.ts`

```typescript
import { Session } from '../types/models';
import { IAdapter } from './adapter';
import path from 'path';
import os from 'os';

export class CopilotAdapter implements IAdapter {
  async getSessions(): Promise<Session[]> {
    try {
      const home = os.homedir();
      const workspaceStorageDir = this.getVSCodeWorkspaceDir(home);
      
      // TODO: Parse VS Code workspace storage for Copilot sessions
      return [];
    } catch (err) {
      console.error('CopilotAdapter error:', err);
      return [];
    }
  }

  private getVSCodeWorkspaceDir(home: string): string {
    const platform = process.platform;
    if (platform === 'win32') {
      const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appdata, 'Code', 'User', 'workspaceStorage');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
    } else {
      const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      return path.join(configDir, 'Code', 'User', 'workspaceStorage');
    }
  }
}
```

- [ ] **Step 4: Create opencode adapter (stub)**

File: `backends/nodejs/src/adapters/opencode.ts`

```typescript
import { Session } from '../types/models';
import { IAdapter } from './adapter';

export class OpenCodeAdapter implements IAdapter {
  async getSessions(): Promise<Session[]> {
    // TODO: Implement OpenCode session parsing
    return [];
  }
}
```

- [ ] **Step 5: Create windsurf adapter (stub)**

File: `backends/nodejs/src/adapters/windsurf.ts`

```typescript
import { Session } from '../types/models';
import { IAdapter } from './adapter';
import path from 'path';
import os from 'os';

export class WindsurfAdapter implements IAdapter {
  async getSessions(): Promise<Session[]> {
    try {
      const home = os.homedir();
      const windsurfDir = this.getWindsurfDir(home);
      
      // TODO: Parse Windsurf session files
      return [];
    } catch (err) {
      console.error('WindsurfAdapter error:', err);
      return [];
    }
  }

  private getWindsurfDir(home: string): string {
    const platform = process.platform;
    if (platform === 'win32') {
      const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return path.join(appdata, 'Codeium', 'windsurf');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Codeium', 'windsurf');
    } else {
      const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      return path.join(configDir, 'Codeium', 'windsurf');
    }
  }
}
```

- [ ] **Step 6: Update Store to use adapters**

Edit `backends/nodejs/src/store/store.ts` to add `loadAll` implementation:

```typescript
// Add to imports
import { ClaudeCodeAdapter } from '../adapters/claudecode';
import { CopilotAdapter } from '../adapters/copilot';
import { OpenCodeAdapter } from '../adapters/opencode';
import { WindsurfAdapter } from '../adapters/windsurf';

// Update loadAll method
async loadAll(): Promise<void> {
  const adapters = [
    new ClaudeCodeAdapter(),
    new CopilotAdapter(),
    new OpenCodeAdapter(),
    new WindsurfAdapter()
  ];

  this.sessions = [];
  for (const adapter of adapters) {
    const sessions = await adapter.getSessions();
    this.sessions.push(...sessions);
  }
}
```

- [ ] **Step 7: Compile and verify**

```bash
cd backends/nodejs
npm run build
cd ../..
```

Expected: Successfully compiles

- [ ] **Step 8: Commit**

```bash
git add backends/nodejs/src/adapters/
git commit -m "feat: implement adapter interfaces for all sources (stubs)"
```

---

## Phase 5: Root-Level Integration

### Task 14: Create Setup Script

**Files:**
- Create: `scripts/setup.js`
- Modify: `package.json` (root)

- [ ] **Step 1: Create setup script**

File: `scripts/setup.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function log(msg) {
  console.log(`\n> ${msg}`);
}

function error(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function success(msg) {
  console.log(`\n✓ ${msg}`);
}

// 1. Check backend.config.json exists
const configPath = path.join(__dirname, '..', 'backend.config.json');
if (!fs.existsSync(configPath)) {
  error(`backend.config.json not found at ${configPath}`);
}

// 2. Read and validate config
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  error(`Failed to parse backend.config.json: ${err.message}`);
}

if (!['go', 'nodejs'].includes(config.backend)) {
  error(`Invalid backend: ${config.backend}. Must be 'go' or 'nodejs'`);
}

log(`Setting up with backend: ${config.backend}`);

// 3. Build web frontend
log('Building web frontend...');
try {
  execSync('cd web && npm install && npm run build', { stdio: 'inherit' });
  success('Web frontend built');
} catch (err) {
  error(`Failed to build web frontend: ${err.message}`);
}

// 4. Install backend dependencies
if (config.backend === 'nodejs') {
  log('Installing NodeJS backend dependencies...');
  try {
    execSync('cd backends/nodejs && npm install && npm run build', { stdio: 'inherit' });
    success('NodeJS backend installed and built');
  } catch (err) {
    error(`Failed to install NodeJS backend: ${err.message}`);
  }
} else if (config.backend === 'go') {
  success('Go backend selected. Will compile on first run.');
}

success(`Setup complete! Run 'npm start' to start the ${config.backend} backend.`);
```

Make executable:
```bash
chmod +x scripts/setup.js
```

- [ ] **Step 2: Create start script**

File: `scripts/start.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function error(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// 1. Read config
const configPath = path.join(__dirname, '..', 'backend.config.json');
if (!fs.existsSync(configPath)) {
  error(`backend.config.json not found. Run 'npm run setup' first.`);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  error(`Failed to parse backend.config.json: ${err.message}`);
}

const port = config.port || 8765;

// 2. Check web/dist exists
const distPath = path.join(__dirname, '..', 'web', 'dist');
if (!fs.existsSync(distPath)) {
  error(`web/dist not found. Run 'npm run setup' first.`);
}

// 3. Start backend
console.log(`\nStarting ${config.backend} backend on port ${port}...\n`);

if (config.backend === 'nodejs') {
  const serverPath = path.join(__dirname, '..', 'backends', 'nodejs', 'dist', 'server.js');
  if (!fs.existsSync(serverPath)) {
    error(`NodeJS server not built. Run 'npm run setup' first.`);
  }
  spawn('node', [serverPath], {
    env: { ...process.env, PORT: port },
    stdio: 'inherit'
  });
} else if (config.backend === 'go') {
  // Look for compiled binary or fallback to go run
  const binPath = path.join(__dirname, '..', 'backends', 'go', 'ai-sessions');
  const goPath = path.join(__dirname, '..', 'backends', 'go', 'main.go');
  
  if (fs.existsSync(binPath)) {
    spawn(binPath, [], {
      env: { ...process.env, PORT: port },
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', 'backends', 'go')
    });
  } else {
    spawn('go', ['run', goPath], {
      env: { ...process.env, PORT: port },
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', 'backends', 'go')
    });
  }
}
```

Make executable:
```bash
chmod +x scripts/start.js
```

- [ ] **Step 3: Update root package.json with setup/start scripts**

Edit `package.json` to add/update scripts section:

```json
{
  "scripts": {
    "setup": "node scripts/setup.js",
    "start": "node scripts/start.js",
    "build:web": "cd web && npm run build",
    "test:web": "cd web && npm test",
    "test:backend": "cd backends/nodejs && npm test"
  }
}
```

- [ ] **Step 4: Verify scripts work (syntax check)**

```bash
node -c scripts/setup.js && node -c scripts/start.js && echo "✓ Scripts are valid"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/setup.js scripts/start.js package.json
git commit -m "feat: add root-level setup and start scripts for backend selection"
```

---

## Phase 6: Testing & Verification

### Task 15: Run Full Build and Test Cycle

**Files:**
- No new files, testing existing implementation

- [ ] **Step 1: Test TypeScript compilation**

```bash
cd backends/nodejs
npm run build
cd ../..
```

Expected: No errors, `backends/nodejs/dist/` created with JavaScript files

- [ ] **Step 2: Verify generated types**

```bash
head -20 backends/nodejs/src/types/models.ts
```

Expected: TypeScript interfaces defined

- [ ] **Step 3: Run unit tests (Node backend)**

```bash
cd backends/nodejs
npm test 2>&1 | head -50
cd ../..
```

Expected: Tests pass for store and handlers

- [ ] **Step 4: Test setup script (validation only)**

```bash
# Don't actually run, just verify it parses valid config
node -c scripts/setup.js && echo "✓ Setup script is valid"
```

- [ ] **Step 5: Verify directory structure matches spec**

```bash
find backends/nodejs/src -type f -name "*.ts" | sort
```

Expected: All modules present (adapters, api, store, watcher, ws, types)

- [ ] **Step 6: Commit any final fixes**

```bash
git status
# If clean, nothing to commit
```

---

### Task 16: Create Documentation for Backend Selection

**Files:**
- Modify: `README.md` or create `docs/BACKEND_SELECTION.md`

- [ ] **Step 1: Create backend selection guide**

File: `docs/BACKEND_SELECTION.md`

```markdown
# Backend Selection Guide

## Quick Start

### Choose Your Backend

1. **Create `backend.config.json` in the project root:**

   **For NodeJS:**
   ```json
   {
     "backend": "nodejs",
     "port": 8765
   }
   ```

   **For Go:**
   ```json
   {
     "backend": "go",
     "port": 8765
   }
   ```

2. **Install and start:**

   ```bash
   npm run setup    # Install chosen backend + web frontend
   npm start        # Start the backend
   ```

3. **Open browser:**

   Navigate to `http://localhost:8765`

## Backend Comparison

| Feature | Go | NodeJS |
|---------|----|----|
| Performance | High | Good |
| Startup Time | Fast | Moderate |
| Memory Usage | Low | Moderate |
| File Size | ~10MB binary | Node + modules |
| Development | Compiled | Interpreted |

## Switching Backends

To switch from one backend to another:

```bash
# Edit the config
echo '{ "backend": "go" }' > backend.config.json

# Reinstall (if needed)
npm run setup

# Start
npm start
```

## Development

### NodeJS Backend Development

```bash
cd backends/nodejs
npm run dev   # Start with ts-node for hot reload
npm test      # Run tests
npm run build # Compile to JavaScript
```

### Go Backend Development

```bash
cd backends/go
go run main.go
# Or with hot reload using air or similar
```

## Deployment

### Deploy NodeJS Backend

```bash
npm run setup   # with backend: "nodejs" in config
npm run build   # Build frontend and backend
# Deploy backends/nodejs/dist/ and web/dist/
```

### Deploy Go Backend

```bash
npm run setup   # with backend: "go" in config
cd backends/go
go build -o ai-sessions main.go
# Deploy binary and web/dist/
```

## Troubleshooting

**Q: "backend.config.json not found"**
A: Create it in the project root with your chosen backend.

**Q: "node_modules not found"**
A: Run `npm run setup` to install dependencies.

**Q: "web/dist not found"**
A: Run `npm run setup` to build the frontend.

**Q: Port already in use**
A: Change the port in `backend.config.json`.
```

- [ ] **Step 2: Update main README to reference backend selection**

Edit `README.md` and add a section:

```markdown
## Quick Start

Choose your backend (Go or NodeJS) and run:

```bash
echo '{ "backend": "nodejs" }' > backend.config.json
npm run setup
npm start
```

See [Backend Selection Guide](./docs/BACKEND_SELECTION.md) for details.
```

- [ ] **Step 3: Commit documentation**

```bash
git add docs/BACKEND_SELECTION.md README.md
git commit -m "docs: add backend selection and setup guide"
```

---

## Phase 7: Final Verification

### Task 17: Verify Zero Impact on Go Backend

**Files:**
- Check: `backends/go/main.go` (unchanged)
- Check: `backends/go/internal/` (unchanged)

- [ ] **Step 1: Verify Go code is untouched**

```bash
git diff backends/go/
# Expected: No output (no changes)
```

- [ ] **Step 2: Verify Go tests still work**

```bash
cd backends/go
go test ./...
cd ../..
```

Expected: All Go tests pass

- [ ] **Step 3: Commit if any cleanup needed**

```bash
git status
# Should be clean
```

---

### Task 18: Integration Test - NodeJS Backend Full Cycle

**Files:**
- Test: Full startup and API call

- [ ] **Step 1: Build TypeScript**

```bash
cd backends/nodejs
npm run build
cd ../..
```

Expected: Successful compilation

- [ ] **Step 2: Verify server can start (dry run)**

```bash
cd backends/nodejs
timeout 3 node dist/server.js || true
cd ../..
```

Expected: Server starts and listens, timeout kills it

- [ ] **Step 3: Verify API endpoint responds (once started)**

```bash
# In one terminal:
npm start &
SERVER_PID=$!
sleep 2

# In another:
curl -s http://localhost:8765/api/health | jq .

# Kill server
kill $SERVER_PID 2>/dev/null || true
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Verify web/dist is served**

```bash
curl -s http://localhost:8765/ | head -20
# Expected: HTML content of React app
```

---

## Final Commits & Summary

### Task 19: Create Comprehensive Test Suite for NodeJS

**Files:**
- Create: `backends/nodejs/__tests__/integration/api.integration.test.ts`

- [ ] **Step 1: Write integration test**

File: `backends/nodejs/__tests__/integration/api.integration.test.ts`

```typescript
import { Store } from '../../src/store/store';
import { createHandler } from '../../src/api/handlers';
import express from 'express';

describe('API Integration', () => {
  let store: Store;

  beforeEach(async () => {
    store = new Store();
    await store.loadAll();
  });

  test('Store loads without errors', async () => {
    expect(store.sessions()).toBeDefined();
  });

  test('Stats endpoint returns correct structure', () => {
    const stats = store.statsForDays(7);
    expect(stats).toHaveProperty('daily');
    expect(stats).toHaveProperty('summary');
    expect(Array.isArray(stats.daily)).toBe(true);
  });

  test('Session filtering works', () => {
    const sessions = store.sessions();
    const filtered = sessions.filter(s => s.source === 'claude-code');
    expect(Array.isArray(filtered)).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
cd backends/nodejs
npm test -- __tests__/integration/
cd ../..
```

Expected: PASS

- [ ] **Step 3: Commit tests**

```bash
git add backends/nodejs/__tests__/integration/
git commit -m "test: add integration tests for nodejs backend"
```

---

### Task 20: Final Verification Checklist

**Files:**
- Check: All requirements met

- [ ] **Step 1: Verify directory structure matches spec**

```bash
cat > /tmp/verify.sh << 'EOF'
#!/bin/bash
echo "Checking required files..."
files=(
  "backend.config.example.json"
  "schemas/models.schema.json"
  "scripts/setup.js"
  "scripts/start.js"
  "scripts/gen-node-types.sh"
  "backends/nodejs/package.json"
  "backends/nodejs/tsconfig.json"
  "backends/nodejs/jest.config.js"
  "backends/nodejs/src/server.ts"
  "backends/nodejs/src/api/handlers.ts"
  "backends/nodejs/src/store/store.ts"
  "backends/nodejs/src/watcher/watcher.ts"
  "backends/nodejs/src/ws/hub.ts"
  "backends/nodejs/src/types/models.ts"
  "docs/BACKEND_SELECTION.md"
)

missing=0
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ MISSING: $file"
    missing=$((missing + 1))
  fi
done

echo ""
if [ $missing -eq 0 ]; then
  echo "All required files present!"
else
  echo "$missing file(s) missing"
fi
EOF
chmod +x /tmp/verify.sh
/tmp/verify.sh
```

Expected: All files present

- [ ] **Step 2: Verify Go backend unchanged**

```bash
git log --oneline backends/go/ | head -1
# Should show only pre-existing Go commits
```

- [ ] **Step 3: Test both backend configs work (setup script)**

```bash
# Test NodeJS config
echo '{ "backend": "nodejs", "port": 8765 }' > backend.config.json
node scripts/setup.js 2>&1 | head -20
# (Will show setup output or errors)
```

- [ ] **Step 4: Create summary commit**

```bash
git log --oneline -20
# Should show all implementation commits
```

- [ ] **Step 5: Final status check**

```bash
git status
```

Expected: Clean working directory

---

## Implementation Notes

### What's Included:
✅ Backend configuration via `backend.config.json`
✅ JSON Schema for data models
✅ NodeJS backend with Express server
✅ All core modules (adapters, api, store, watcher, ws)
✅ Root-level setup and start scripts
✅ Type generation (TypeScript)
✅ Unit and integration tests for Node
✅ Documentation for backend selection
✅ Zero impact on Go backend

### What's Stubbed (for later):
- Adapter implementations (parsing session files) — they return empty arrays but structure is in place
- Some API endpoints (tools, system, history, insights, tasks)
- Full WebSocket broadcasting logic (hub structure is ready)

### Next Steps After Implementation:
1. Implement adapter parsing logic (claudecode, copilot, opencode, windsurf)
2. Implement full API endpoints (system info, tool samples, insights, etc.)
3. Add comprehensive test coverage for adapters
4. Performance testing and optimization
5. Docker containerization for both backends
6. Release and user documentation

---

**Plan saved to:** `docs/superpowers/plans/2026-04-15-flexible-backend-selection.md`

