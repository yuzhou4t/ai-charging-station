#!/usr/bin/env node
import { loadEnvFiles } from './env.js';
import { runDailyDigest } from '../src/index.js';
import { formatDigestReport } from '../src/report.js';

loadEnvFiles();

const outputDir = process.env.DIGEST_OUTPUT_DIR || 'data';
const rsshubBaseUrl = process.env.RSSHUB_BASE_URL || 'http://127.0.0.1:1200';
const targetDate = readTargetDate();

try {
  const { digest, paths } = await runDailyDigest({ outputDir, rsshubBaseUrl, targetDate });
  const okCount = Object.values(digest.sourceHealth).filter((status) => status.ok).length;
  const totalCount = Object.keys(digest.sourceHealth).length;

  console.log(`AI充电站 ${digest.date}`);
  console.log(`Sources: ${okCount}/${totalCount} ok`);
  console.log(`Items: ${digest.items.length}`);
  console.log(`JSON: ${paths.jsonPath}`);
  console.log(`Markdown: ${paths.markdownPath}`);

  if (digest.editorNotes.length) {
    console.log('Notes:');
    for (const note of digest.editorNotes) {
      console.log(`- ${note}`);
    }
  }

  console.log('');
  console.log(formatDigestReport(digest));
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}

function readTargetDate() {
  const arg = process.argv.find((value) => value.startsWith('--date='));
  return process.env.DIGEST_DATE || (arg ? arg.slice('--date='.length) : null);
}
