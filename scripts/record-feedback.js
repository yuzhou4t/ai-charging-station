#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { recordItemFeedback } from '../src/feedback.js';
import { loadEnvFiles } from './env.js';

loadEnvFiles();

const args = parseArgs(process.argv.slice(2));
const rating = args.rating || args.r;
const title = args.title || '';
const url = args.url || '';
const id = args.id || '';

if (!rating || (!title && !url && !id)) {
  printUsage();
  process.exit(1);
}

const outputDir = process.env.DIGEST_OUTPUT_DIR || 'data';
const feedbackPath = process.env.AIHOT_FEEDBACK_PATH || join(outputDir, 'feedback/items.json');

try {
  const digestItem = id ? await findLatestDigestItem(outputDir, id) : null;
  await recordItemFeedback(feedbackPath, {
    title: title || digestItem?.title || '',
    url: url || digestItem?.url || '',
    sourceId: args.sourceId || digestItem?.sourceId || 'aihot',
    sourceName: args.sourceName || digestItem?.sourceName || 'AI HOT',
    rating,
    tags: parseTags(args.tags),
    note: args.note || '',
  });

  console.log(`已记录 AI HOT 反馈：${rating} ${title || digestItem?.title || url || id}`);
  console.log(`文件：${feedbackPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseArgs(values) {
  const result = {};
  for (const value of values) {
    if (!value.startsWith('--')) {
      continue;
    }
    const [key, ...rest] = value.slice(2).split('=');
    result[key] = rest.join('=');
  }
  return result;
}

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function findLatestDigestItem(outputDir, id) {
  const latest = JSON.parse(await readFile(join(outputDir, 'latest.json'), 'utf8'));
  const digestPath = join(outputDir, latest.json || `digests/${latest.date}.json`);
  const digest = JSON.parse(await readFile(digestPath, 'utf8'));
  const item = (digest.items || []).find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`没有在最新日报中找到条目 id：${id}`);
  }
  return item;
}

function printUsage() {
  console.log('用法：npm run feedback -- --rating=good --title="标题" --url="https://..." --tags="codex,automation"');
  console.log('也可以降低权重：npm run feedback -- --rating=down --id="aihot-xxxx" --tags="低相关"');
  console.log('rating 可选：good、normal、down、hide；hide 仅用于精确隐藏某一条。');
}
