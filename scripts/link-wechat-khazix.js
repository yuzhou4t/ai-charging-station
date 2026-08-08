#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

import { parseFeedXml } from '../src/fetchers.js';
import { findFeedUrl, upsertEnvValue } from '../src/wechat-rss-link.js';
import { loadEnvFiles } from './env.js';

loadEnvFiles();

const baseUrl = (process.env.WE_MP_RSS_BASE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
const envPath = '.env';
const names = ['数字生命卡兹克', '卡兹克', 'Rockhazix'];

try {
  const response = await fetch(`${baseUrl}/rss`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const items = parseFeedXml(xml, {
    id: 'we-mp-rss-feeds',
    name: 'we-mp-rss',
    platform: 'wechat',
    group: 'creator',
  });
  const feedUrl = findFeedUrl(items, names);

  if (!feedUrl) {
    console.log('没有在 we-mp-rss 订阅列表里找到数字生命卡兹克。当前订阅：');
    for (const item of items) {
      console.log(`- ${item.title}: ${item.url}`);
    }
    process.exit(1);
  }

  let envText = '';
  try {
    envText = await readFile(envPath, 'utf8');
  } catch {
    envText = '';
  }

  await writeFile(envPath, upsertEnvValue(envText, 'WECHAT_KHAZIX_RSS_URL', feedUrl), 'utf8');
  console.log(`已写入 WECHAT_KHAZIX_RSS_URL=${feedUrl}`);
  console.log('现在可以运行：npm run wechat:doctor && npm run digest');
} catch (error) {
  console.error(`绑定卡兹克 we-mp-rss feed 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
