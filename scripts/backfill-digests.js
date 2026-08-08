#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadEnvFiles } from './env.js';
import { runDailyDigest } from '../src/index.js';
import { formatDigestReport } from '../src/report.js';
import { buildDigestIndex } from '../src/digest-index.js';

loadEnvFiles();

const outputDir = process.env.DIGEST_OUTPUT_DIR || 'data';
const rsshubBaseUrl = process.env.RSSHUB_BASE_URL || 'http://127.0.0.1:1200';
const days = Number(readArg('days') || 7);
const endDate = readArg('end') || yesterdayBeijingDate(new Date());
const preserveLatest = readArg('preserve-latest') !== 'false';
const latestPath = join(outputDir, 'latest.json');
const sourceStatePath = join(outputDir, 'source-state.json');
const latestSnapshot = preserveLatest ? await readOptional(latestPath) : null;
const sourceStateSnapshot = await readOptional(sourceStatePath);
const dates = buildDateRange(endDate, days);
const summaries = [];

try {
  for (const date of dates) {
    if (sourceStateSnapshot !== null) {
      await writeFile(sourceStatePath, sourceStateSnapshot, 'utf8');
    }

    const { digest, paths } = await runDailyDigest({ outputDir, rsshubBaseUrl, targetDate: date });
    summaries.push({
      date,
      items: digest.items.length,
      ok: Object.values(digest.sourceHealth).filter((status) => status.ok).length,
      totalSources: Object.keys(digest.sourceHealth).length,
      json: paths.jsonPath,
      markdown: paths.markdownPath,
      report: formatDigestReport(digest, { limits: { mustRead: 3, creatorUpdates: 3, officialUpdates: 3, aihotPicks: 3 } }),
    });
  }
} finally {
  if (sourceStateSnapshot !== null) {
    await writeFile(sourceStatePath, sourceStateSnapshot, 'utf8');
  }
  if (latestSnapshot !== null) {
    await writeFile(latestPath, latestSnapshot, 'utf8');
  }
}

const index = await buildDigestIndex(outputDir);

console.log(`AI充电站历史回填：${dates[0]} 至 ${dates.at(-1)}`);
for (const summary of summaries) {
  console.log(`- ${summary.date}: ${summary.items} 条，源 ${summary.ok}/${summary.totalSources} OK`);
  console.log(`  JSON: ${summary.json}`);
  console.log(`  Markdown: ${summary.markdown}`);
}
console.log(`索引: data/digests/index.json（${index.count} 天）`);

console.log('\n最近一天摘要预览：');
console.log(summaries.at(-1)?.report || '无。');

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

function buildDateRange(end, count) {
  const dates = [];
  const endDateValue = parseBeijingDate(end);
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(endDateValue.getTime() - index * 24 * 36e5);
    dates.push(formatDate(date));
  }
  return dates;
}

function yesterdayBeijingDate(now) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = parseBeijingDate(formatter.format(now));
  return formatDate(new Date(today.getTime() - 24 * 36e5));
}

function parseBeijingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}. Expected YYYY-MM-DD.`);
  }
  return new Date(`${value}T00:00:00+08:00`);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
