#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { loadEnvFiles } from './env.js';
import { SOURCES } from '../src/sources.js';

loadEnvFiles();

const rootDir = process.cwd();
const forgeRssDir = join(rootDir, 'vendor', 'ForgeRSS');
const feedPath = join(forgeRssDir, 'feeds', 'feed_xiaohongshu_user.xml');
const maxNotes = process.env.FORGERSS_XHS_MAX || '10';

const xhsSources = SOURCES.filter((source) => source.platform === 'xiaohongshu' && source.forgeRssPath);

try {
  if (!xhsSources.length) {
    console.log('No Xiaohongshu ForgeRSS sources configured; skipping.');
    process.exit(0);
  }

  await ensurePath(join(forgeRssDir, 'scripts', 'run_single.py'), 'ForgeRSS is not installed at vendor/ForgeRSS.');
  const python = await resolvePython();
  let successCount = 0;

  for (const source of xhsSources) {
    const userInput = process.env[source.forgeRssEnv] || source.homepage;
    if (!userInput) {
      console.log(`Skip ${source.name}: missing ${source.forgeRssEnv || 'ForgeRSS user input'}`);
      continue;
    }

    console.log(`ForgeRSS Xiaohongshu: ${source.name}`);
    const code = await runForgeRss(python, userInput);
    if (code !== 0) {
      console.log(`ForgeRSS failed for ${source.name} with exit code ${code}`);
      continue;
    }

    const outputPath = resolve(rootDir, source.forgeRssPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(feedPath, outputPath);
    console.log(`Copied ${source.name} feed to ${source.forgeRssPath}`);
    successCount += 1;
  }

  if (!successCount) {
    console.error('No Xiaohongshu ForgeRSS feeds were refreshed.');
    process.exitCode = 1;
  }
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

function runForgeRss(python, userInput) {
  return new Promise((resolveExit) => {
    const child = spawn(python, ['scripts/run_single.py', 'xiaohongshu_user', '--full', '--max', maxNotes], {
      cwd: forgeRssDir,
      env: {
        ...process.env,
        XHS_USER_ID: userInput,
        XHS_MAX_NOTES: maxNotes,
        XHS_DOWNLOAD_MEDIA: process.env.FORGERSS_XHS_DOWNLOAD_MEDIA || 'false',
      },
      stdio: 'inherit',
    });

    child.on('close', (code) => resolveExit(code || 0));
    child.on('error', () => resolveExit(1));
  });
}
