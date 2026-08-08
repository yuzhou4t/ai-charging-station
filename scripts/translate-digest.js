#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { prepareDigestForOutput, renderMarkdown } from '../src/digest.js';
import { applyDigestTranslations, createExternalTranslator } from '../src/translate-digest.js';
import { loadEnvFiles } from './env.js';

loadEnvFiles();

const outputDir = process.env.DIGEST_OUTPUT_DIR || 'data';
const targetDate = readArg('date');
const force = process.argv.includes('--force');

try {
  const { jsonPath, markdownPath } = await resolveDigestPaths(outputDir, targetDate);
  const digest = JSON.parse(await readFile(jsonPath, 'utf8'));
  const translateItem = createExternalTranslator();
  const result = await applyDigestTranslations(digest, { translateItem, force });
  const outputDigest = prepareDigestForOutput(result.digest);

  await writeFile(jsonPath, `${JSON.stringify(outputDigest, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, renderMarkdown(outputDigest), 'utf8');

  console.log(`Translated digest: ${jsonPath}`);
  console.log(`Updated translations: ${result.changedCount}`);
  if (result.cleanedCount) {
    console.log(`Removed legacy local translations: ${result.cleanedCount}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}

async function resolveDigestPaths(baseDir, date) {
  if (date) {
    return {
      jsonPath: join(baseDir, 'digests', `${date}.json`),
      markdownPath: join(baseDir, 'digests', `${date}.md`),
    };
  }

  const latest = JSON.parse(await readFile(join(baseDir, 'latest.json'), 'utf8'));
  const jsonPath = join(baseDir, latest.json || `digests/${latest.date}.json`);
  return {
    jsonPath,
    markdownPath: jsonPath.replace(/\.json$/i, '.md'),
  };
}

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}
