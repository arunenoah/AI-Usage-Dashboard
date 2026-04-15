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
