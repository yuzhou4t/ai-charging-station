#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { loadEnvFiles } from './env.js';

loadEnvFiles();

const root = resolve('vendor/we-mp-rss');
const python = resolve(process.env.WE_MP_RSS_PYTHON || 'vendor/we-mp-rss/.venv/bin/python');
const config = resolve(root, 'config.yaml');
const pidFile = resolve(process.env.WE_MP_RSS_PID_FILE || '.we-mp-rss.pid');
const logFile = resolve(process.env.WE_MP_RSS_LOG_FILE || 'logs/we-mp-rss.log');
const port = process.env.WE_MP_RSS_PORT || '8001';

if (!existsSync(root)) {
  console.error(`we-mp-rss directory not found: ${root}`);
  console.error('Clone https://github.com/rachelos/we-mp-rss into vendor/we-mp-rss first.');
  process.exit(1);
}

if (!existsSync(python)) {
  console.error(`Python runtime not found: ${python}`);
  console.error('Create the virtualenv and install requirements before starting we-mp-rss.');
  process.exit(1);
}

if (!existsSync(config)) {
  console.error(`Config file not found: ${config}`);
  console.error('Copy vendor/we-mp-rss/config.example.yaml to vendor/we-mp-rss/config.yaml first.');
  process.exit(1);
}

await mkdir(dirname(logFile), { recursive: true });
const logFd = openSync(logFile, 'a');
const env = {
  ...process.env,
  PORT: port,
  ENABLE_JOB: process.env.WE_MP_RSS_ENABLE_JOB || 'True',
  WERSS_AUTH_WEB: process.env.WERSS_AUTH_WEB || 'True',
  REDIS_SERVER_ENABLED: process.env.REDIS_SERVER_ENABLED || 'False',
  REDIS_URL: process.env.REDIS_URL || '',
  'GATHER.CONTENT_AUTO_CHECK': process.env.GATHER_CONTENT_AUTO_CHECK || 'False',
  ARTICLE_STATS_REFRESH_ENABLED: process.env.ARTICLE_STATS_REFRESH_ENABLED || 'False',
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || resolve('vendor/we-mp-rss/.playwright-browsers'),
  RSS_BASE_URL: process.env.WE_MP_RSS_BASE_URL || `http://127.0.0.1:${port}/`,
  RSS_LOCAL: process.env.WE_MP_RSS_LOCAL || 'False',
};

const child = spawn(python, ['main.py', '-job', 'True', '-init', 'True'], {
  cwd: root,
  env,
  detached: true,
  stdio: ['ignore', logFd, logFd],
});

child.unref();
closeSync(logFd);

await writeFile(pidFile, `${child.pid}\n`, 'utf8');
console.log(`we-mp-rss starting on http://127.0.0.1:${port}`);
console.log(`PID: ${child.pid}`);
console.log(`Log: ${logFile}`);
