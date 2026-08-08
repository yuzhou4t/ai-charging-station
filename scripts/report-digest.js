#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { formatDigestReport } from '../src/report.js';

const outputDir = process.env.DIGEST_OUTPUT_DIR || 'data';

try {
  const latest = JSON.parse(await readFile(join(outputDir, 'latest.json'), 'utf8'));
  const digestPath = join(outputDir, latest.json || `digests/${latest.date}.json`);
  const digest = JSON.parse(await readFile(digestPath, 'utf8'));
  console.log(formatDigestReport(digest));
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}
