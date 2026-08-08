import test from 'node:test';
import assert from 'node:assert/strict';

import { findFeedUrl, upsertEnvValue } from '../src/wechat-rss-link.js';

test('findFeedUrl returns a matching we-mp-rss feed URL', () => {
  const url = findFeedUrl(
    [
      { title: '别的公众号', url: 'http://127.0.0.1:8001/rss/other' },
      { title: '数字生命卡兹克', url: 'http://127.0.0.1:8001/rss/khazix' },
    ],
    ['数字生命卡兹克', '卡兹克', 'Rockhazix']
  );

  assert.equal(url, 'http://127.0.0.1:8001/rss/khazix');
});

test('upsertEnvValue updates only the requested key', () => {
  const next = upsertEnvValue('RSSHUB_BASE_URL=http://127.0.0.1:1200\nWECHAT_KHAZIX_RSS_URL=\n', 'WECHAT_KHAZIX_RSS_URL', 'http://127.0.0.1:8001/rss/khazix');

  assert.equal(next, 'RSSHUB_BASE_URL=http://127.0.0.1:1200\nWECHAT_KHAZIX_RSS_URL=http://127.0.0.1:8001/rss/khazix\n');
});

test('upsertEnvValue appends missing keys', () => {
  const next = upsertEnvValue('RSSHUB_BASE_URL=http://127.0.0.1:1200\n', 'WECHAT_KHAZIX_RSS_URL', 'http://127.0.0.1:8001/rss/khazix');

  assert.equal(next, 'RSSHUB_BASE_URL=http://127.0.0.1:1200\nWECHAT_KHAZIX_RSS_URL=http://127.0.0.1:8001/rss/khazix\n');
});
