import { buildDigest, writeDigest } from './digest.js';
import { SOURCES } from './sources.js';
import { join } from 'node:path';

export async function runDailyDigest(options = {}) {
  const outputDir = options.outputDir || 'data';
  const digest = await buildDigest({
    sources: options.sources || SOURCES,
    now: options.now || new Date(),
    targetDate: options.targetDate,
    rsshubBaseUrl: options.rsshubBaseUrl,
    sourceStatePath: options.sourceStatePath || join(outputDir, 'source-state.json'),
    manualLinksPath: options.manualLinksPath || join(outputDir, 'manual-links.json'),
    feedbackPath: options.feedbackPath || join(outputDir, 'feedback/items.json'),
  });
  const paths = await writeDigest(digest, outputDir, {
    preserveExistingItems: options.preserveExistingItems ?? !options.targetDate,
  });
  return { digest, paths };
}

export { buildDigest, writeDigest, SOURCES };
