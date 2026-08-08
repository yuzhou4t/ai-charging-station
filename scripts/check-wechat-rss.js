#!/usr/bin/env node
import { loadEnvFiles } from './env.js';
import { fetchSource } from '../src/fetchers.js';

loadEnvFiles();

const baseUrl = process.env.WE_MP_RSS_BASE_URL || 'http://127.0.0.1:8001';
const feedUrl = process.env.WECHAT_KHAZIX_RSS_URL || '';

const baseOk = await checkBaseUrl(baseUrl);
if (!feedUrl) {
  console.log('WECHAT_KHAZIX_RSS_URL is not set. Subscribe to 数字生命卡兹克 in we-mp-rss, copy its RSS URL, then add it to .env.');
  process.exitCode = baseOk ? 1 : 2;
} else {
  await checkFeed(feedUrl);
}

async function checkBaseUrl(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    console.log(`we-mp-rss reachable at ${url}: HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.error(`we-mp-rss is not reachable at ${url}`);
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function checkFeed(url) {
  try {
    const items = await fetchSource(
      {
        id: 'wechat-khazix',
        name: '数字生命卡兹克',
        platform: 'wechat',
        kind: 'rss',
        group: 'creator',
        url,
      },
      { timeoutMs: 20_000 }
    );

    console.log(`WECHAT_KHAZIX_RSS_URL ok: ${items.length} items`);
    if (items[0]) {
      console.log(`Latest: ${items[0].title}`);
      console.log(`Published: ${items[0].publishedAt || 'unknown'}`);
      console.log(`URL: ${items[0].url || 'unknown'}`);
    }
  } catch (error) {
    console.error(`WECHAT_KHAZIX_RSS_URL failed: ${url}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
