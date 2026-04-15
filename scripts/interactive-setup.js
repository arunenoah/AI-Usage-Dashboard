#!/usr/bin/env node

const { execSync } = require('child_process');

function error(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`\n${msg}`);
}

try {
  // Run setup (which is now interactive if config doesn't exist)
  log('Running setup...');
  execSync('npm run setup', { stdio: 'inherit' });

  // Run start
  log('Starting frontend and backend...');
  log('Press Ctrl+C to stop.\n');
  execSync('npm start', { stdio: 'inherit' });
} catch (err) {
  // Normal when user presses Ctrl+C
  if (err.signal !== 'SIGINT') {
    error(`Error: ${err.message}`);
  } else {
    log('Server stopped.');
  }
}
