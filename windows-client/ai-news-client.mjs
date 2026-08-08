#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const AIHOT_BASE_URL = 'https://aihot.virxact.com';
const DAILY_URL =
  process.env.AI_CHARGING_STATION_DAILY_URL ||
  'https://raw.githubusercontent.com/yuzhou4t/ai-charging-station/assistant-feed/latest.json';
const CACHE_DIR =
  process.env.AI_NEWS_CACHE_DIR ||
  join(process.env.LOCALAPPDATA || join(homedir(), '.cache'), 'ai-news-client');

const { command, options } = parseArgs(process.argv.slice(2));

try {
  const result = await run(command, options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function run(command, options) {
  if (command === 'daily') {
    return fetchJson(DAILY_URL);
  }

  if (command === 'hot-topics') {
    return fetchJson(`${AIHOT_BASE_URL}/api/v1/hot-topics`);
  }

  if (command === 'items') {
    return fetchJson(buildItemsUrl(options));
  }

  if (command === 'brief') {
    const [daily, products, papers, finance, codex] = await Promise.all([
      fetchJson(DAILY_URL),
      fetchJson(buildItemsUrl({ window: '24h', category: 'ai-products', limit: '10' })),
      fetchJson(buildItemsUrl({ window: '7d', category: 'paper', limit: '10' })),
      fetchJson(buildItemsUrl({ window: '7d', query: '金融', limit: '10' })),
      fetchJson(buildItemsUrl({ window: '7d', query: 'Codex', limit: '10' })),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      daily,
      recommendations: {
        aiProducts: products.items || [],
        papers: papers.items || [],
        aiFinance: finance.items || [],
        codexAndDevelopment: codex.items || [],
      },
    };
  }

  throw new Error(`未知命令：${command}。可用命令：brief、daily、items、hot-topics。`);
}

function buildItemsUrl(options) {
  const url = new URL('/api/v1/items', AIHOT_BASE_URL);
  url.searchParams.set('mode', options.mode || 'selected');
  url.searchParams.set('window', options.window || '24h');
  url.searchParams.set('by', options.by || 'timeline');
  url.searchParams.set('limit', options.limit || '20');
  if (options.category) url.searchParams.set('category', options.category);
  if (options.query) url.searchParams.set('q', options.query);
  if (options.cursor) url.searchParams.set('cursor', options.cursor);
  return url.toString();
}

async function fetchJson(url) {
  const cachePath = join(CACHE_DIR, `${createHash('sha256').update(url).digest('hex')}.json`);
  const cached = await readCache(cachePath);
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'Chen-Shaozes-Windows-Assistant/1.0',
  };
  if (cached?.etag) headers['If-None-Match'] = cached.etag;

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 304 && cached?.body) {
    return cached.body;
  }

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id');
    const retryAfter = response.headers.get('retry-after');
    throw new Error(
      `请求失败：HTTP ${response.status}${retryAfter ? `，${retryAfter} 秒后重试` : ''}${requestId ? `，requestId=${requestId}` : ''}`
    );
  }

  const body = await response.json();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    cachePath,
    JSON.stringify({ etag: response.headers.get('etag'), fetchedAt: new Date().toISOString(), body }),
    'utf8'
  );
  return body;
}

async function readCache(cachePath) {
  try {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(args) {
  const command = args[0] || 'brief';
  const options = {};

  for (let index = 1; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key.startsWith('--') || value === undefined) {
      throw new Error(`参数格式错误：${key}`);
    }
    const optionName = key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[optionName] = value;
    index += 1;
  }

  return { command, options };
}
