#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

function question(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function setupAsync() {
  const configPath = path.join(__dirname, '..', 'backend.config.json');
  let config;

  // 1. Check if config exists, if not ask user
  if (!fs.existsSync(configPath)) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   AI-Usage-Dashboard Setup                                ║
║   Configure your backend                                  ║
╚════════════════════════════════════════════════════════════╝
    `);

    console.log('Which backend would you like to use?\n');
    console.log('  1) NodeJS (JavaScript/TypeScript, interpreted)');
    console.log('  2) Go (Compiled, high performance)');

    const backendChoice = await question('\nEnter your choice (1 or 2): ');

    let backend;
    if (backendChoice === '1') {
      backend = 'nodejs';
    } else if (backendChoice === '2') {
      backend = 'go';
    } else {
      error('Invalid choice. Please enter 1 or 2.');
    }

    const portInput = await question('\nEnter port (default 8765): ');
    const port = portInput.trim() ? parseInt(portInput) : 8765;

    if (isNaN(port) || port < 1 || port > 65535) {
      error('Invalid port number. Must be between 1 and 65535.');
    }

    config = { backend, port };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    success(`Configuration created: backend=${backend}, port=${port}`);
  } else {
    // 2. Read and validate existing config
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      error(`Failed to parse backend.config.json: ${err.message}`);
    }

    if (!['go', 'nodejs'].includes(config.backend)) {
      error(`Invalid backend: ${config.backend}. Must be 'go' or 'nodejs'`);
    }

    log(`Using existing config: backend=${config.backend}, port=${config.port || 8765}`);
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
}

// Run async setup
setupAsync().catch(err => {
  error(`Unexpected error: ${err.message}`);
});
