#!/usr/bin/env node
import { buildDigestIndex } from '../src/digest-index.js';

const outputDir = process.env.DIGEST_OUTPUT_DIR || 'data';

try {
  const index = await buildDigestIndex(outputDir);
  console.log(`Digest index: ${index.count} days`);
  console.log(`Latest date: ${index.latestDate || 'none'}`);
  console.log(`${outputDir}/digests/index.json`);
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}
