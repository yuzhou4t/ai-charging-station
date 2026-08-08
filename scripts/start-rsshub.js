#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { loadEnvFiles } from './env.js';

loadEnvFiles();

const rsshubDir = resolve(process.env.RSSHUB_DIR || 'vendor/RSSHub');
const entry = resolve(rsshubDir, 'dist/index.mjs');
const pidFile = resolve(process.env.RSSHUB_PID_FILE || '.rsshub.pid');
const logFile = resolve(process.env.RSSHUB_LOG_FILE || 'logs/rsshub.log');
const port = process.env.RSSHUB_PORT || process.env.PORT || '1200';

if (!existsSync(rsshubDir)) {
  console.error(`RSSHub directory not found: ${rsshubDir}`);
  console.error('Clone RSSHub into vendor/RSSHub, install dependencies, build it, then run npm run rsshub:start again.');
  process.exit(1);
}

if (!existsSync(entry)) {
  console.error(`RSSHub build output not found: ${entry}`);
  console.error('Run RSSHub build first: cd vendor/RSSHub && pnpm run build');
  process.exit(1);
}

mkdirSync(dirname(logFile), { recursive: true });

const out = await import('node:fs').then((fs) => fs.openSync(logFile, 'a'));
const child = spawn(process.execPath, [entry], {
  cwd: rsshubDir,
  detached: true,
  stdio: ['ignore', out, out],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: port,
    LISTEN_INADDR_ANY: '0',
    DISABLE_IPV6: '1',
  },
});

child.unref();
writeFileSync(pidFile, `${child.pid}\n`, 'utf8');

console.log(`RSSHub started at http://127.0.0.1:${port}`);
console.log(`PID: ${child.pid}`);
console.log(`PID file: ${pidFile}`);
console.log(`Log: ${logFile}`);
