#!/usr/bin/env node
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const pidFile = resolve(process.env.RSSHUB_PID_FILE || '.rsshub.pid');

let pid;
try {
  pid = Number.parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
} catch {
  console.log('RSSHub PID file not found; nothing to stop.');
  process.exit(0);
}

if (!Number.isFinite(pid)) {
  console.error(`Invalid PID in ${pidFile}`);
  process.exit(1);
}

try {
  process.kill(pid, 'SIGTERM');
  rmSync(pidFile, { force: true });
  console.log(`Stopped RSSHub process ${pid}.`);
} catch (error) {
  rmSync(pidFile, { force: true });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
