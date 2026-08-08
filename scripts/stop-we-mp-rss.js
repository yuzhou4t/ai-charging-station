#!/usr/bin/env node
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const pidFile = resolve(process.env.WE_MP_RSS_PID_FILE || '.we-mp-rss.pid');

try {
  const pid = Number((await readFile(pidFile, 'utf8')).trim());
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid PID in ${pidFile}`);
  }

  process.kill(-pid, 'SIGTERM');
  await rm(pidFile, { force: true });
  console.log(`Stopped we-mp-rss process group ${pid}`);
} catch (error) {
  console.error(`Unable to stop we-mp-rss: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
