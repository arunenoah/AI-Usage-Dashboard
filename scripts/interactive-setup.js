#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const configPath = path.join(__dirname, '..', 'backend.config.json');

function log(msg) {
  console.log(`\n${msg}`);
}

function success(msg) {
  console.log(`\n✓ ${msg}`);
}

function error(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   AI-Usage-Dashboard - Backend Selection & Setup          ║
╚════════════════════════════════════════════════════════════╝
  `);

  let backend;

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    log(`Using existing backend: ${config.backend}`);
    backend = config.backend;
  } else {
    // Ask user which backend
    console.log('Which backend would you like to use?');
    console.log('  1) NodeJS (JavaScript/TypeScript, interpreted)');
    console.log('  2) Go (Compiled, high performance)');

    const answer = await question('\nEnter your choice (1 or 2): ');

    if (answer === '1') {
      backend = 'nodejs';
    } else if (answer === '2') {
      backend = 'go';
    } else {
      error('Invalid choice. Please enter 1 or 2.');
    }

    // Ask for port
    const portAnswer = await question('\nEnter port (default 8765): ');
    const port = portAnswer.trim() || '8765';

    // Create config
    const config = { backend, port: parseInt(port) };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    success(`Configuration created: backend=${backend}, port=${port}`);
  }

  rl.close();

  // Run setup
  log(`Setting up ${backend} backend with web frontend...`);
  try {
    execSync('npm run setup', { stdio: 'inherit' });
  } catch (err) {
    error(`Setup failed: ${err.message}`);
  }

  // Run start
  log(`Starting ${backend} backend...`);
  success(`Frontend and backend running at http://localhost:8765`);
  log('Press Ctrl+C to stop.\n');

  try {
    execSync('npm start', { stdio: 'inherit' });
  } catch (err) {
    // Normal when user presses Ctrl+C
    log('\nServer stopped.');
  }
}

main().catch(err => {
  error(`Unexpected error: ${err.message}`);
});
