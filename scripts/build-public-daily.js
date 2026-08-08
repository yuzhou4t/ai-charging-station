#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPublicDaily } from '../src/public-daily.js';
import { loadEnvFiles } from './env.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFiles();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await buildPublicDailyFromDisk();
  console.log(result.outputPath);
}

export async function buildPublicDailyFromDisk(options = {}) {
  const dataDir = resolve(options.dataDir || process.env.AI_CHARGING_STATION_DATA_DIR || join(rootDir, 'data'));
  const outputPath = resolve(
    options.outputPath || process.env.AI_CHARGING_STATION_PUBLIC_OUTPUT || join(dataDir, 'public-api', 'latest.json')
  );
  const latest = JSON.parse(await readFile(join(dataDir, 'latest.json'), 'utf8'));
  const digestPath = resolveDigestPath(dataDir, latest);
  const digest = JSON.parse(await readFile(digestPath, 'utf8'));
  const payload = buildPublicDaily(digest);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { outputPath, payload };
}

function resolveDigestPath(dataDir, latest) {
  const relativePath = latest.json || `digests/${latest.date}.json`;
  const digestPath = resolve(dataDir, relativePath);
  const dataPrefix = `${dataDir}${sep}`;

  if (isAbsolute(relativePath) || !digestPath.startsWith(dataPrefix)) {
    throw new Error(`latest.json 包含不安全的日报路径：${relativePath}`);
  }

  return digestPath;
}
