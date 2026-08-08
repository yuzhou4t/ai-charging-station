import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchAiHotApiItems } from '../src/aihot-flow-fetch.js';

test('fetchAiHotApiItems uses the stable v1 contract and follows its cursor', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    const cursor = url.searchParams.get('cursor');
    const item = {
      id: cursor ? 'second' : 'first',
      title: cursor ? '第二条' : '第一条',
      summary: '摘要',
      source: { name: '测试来源' },
      links: { original: `https://example.com/${cursor ? 'second' : 'first'}` },
      publishedAt: '2026-08-08T10:00:00.000Z',
      category: 'ai-products',
      score: 80,
      selected: true,
    };

    return new Response(
      JSON.stringify({
        schemaVersion: 1,
        items: [item],
        page: { nextCursor: cursor ? null : 'next-page' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const items = await fetchAiHotApiItems({ maxItems: 2 });
    assert.equal(items.length, 2);
    assert.equal(items[0].url, 'https://example.com/first');
    assert.equal(items[0].externalSource, '测试来源');
    assert.equal(urls[0].pathname, '/api/v1/items');
    assert.equal(urls[0].searchParams.get('window'), '7d');
    assert.equal(urls[0].searchParams.get('limit'), '2');
    assert.equal(urls[1].searchParams.get('cursor'), 'next-page');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
