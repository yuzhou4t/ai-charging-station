#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { loadEnvFiles } from './env.js';

loadEnvFiles();

const rootDir = process.cwd();
const forgeRssDir = join(rootDir, 'vendor', 'ForgeRSS');
const mode = process.argv.includes('--login') ? '--login' : '--check';

try {
  await ensurePath(join(forgeRssDir, 'generators', 'social', 'xiaohongshu', 'scraper.py'), 'ForgeRSS is not installed at vendor/ForgeRSS.');
  const python = await resolvePython();
  const code = await runSessionCommand(python, mode);
  process.exitCode = code;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function resolvePython() {
  const configured = process.env.FORGERSS_PYTHON;
  if (configured) {
    const path = resolve(rootDir, configured);
    await ensurePath(path, `Configured FORGERSS_PYTHON does not exist: ${configured}`);
    return path;
  }

  const venvPython = join(forgeRssDir, '.venv', 'bin', 'python');
  try {
    await access(venvPython);
    return venvPython;
  } catch {
    return 'python3';
  }
}

async function ensurePath(path, message) {
  try {
    await access(path);
  } catch {
    throw new Error(message);
  }
}

function runSessionCommand(python, mode) {
  return new Promise((resolveExit) => {
    const child = spawn(python, ['-m', 'generators.social.xiaohongshu.scraper', mode], {
      cwd: forgeRssDir,
      env: process.env,
      stdio: 'inherit',
    });

    child.on('close', (code) => resolveExit(code || 0));
    child.on('error', () => resolveExit(1));
  });
}
