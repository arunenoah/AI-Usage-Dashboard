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
