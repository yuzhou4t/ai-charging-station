import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchSource, parseFeedXml } from '../src/fetchers.js';

const rssXml = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Give your agent its own computer]]></title>
    <link>https://www.langchain.com/blog/give-your-ai-agent-its-own-computer</link>
    <description><![CDATA[Running code execution in an AI agent is harder than it looks.]]></description>
    <pubDate>Fri, 05 Jun 2026 17:33:10 GMT</pubDate>
    <author>noreply@aihot.virxact.com (X：LangChain (@LangChainAI))</author>
  </item>
</channel></rss>`;

test('parseFeedXml normalizes RSS items into digest items', () => {
  const items = parseFeedXml(rssXml, {
    id: 'langchain-blog',
    name: 'LangChain Blog',
    group: 'official',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].sourceId, 'langchain-blog');
  assert.equal(items[0].title, 'Give your agent its own computer');
  assert.equal(items[0].url, 'https://www.langchain.com/blog/give-your-ai-agent-its-own-computer');
  assert.equal(items[0].group, 'official');
  assert.equal(items[0].publishedAt, '2026-06-05T17:33:10.000Z');
  assert.equal(items[0].externalSource, 'X：LangChain (@LangChainAI)');
  assert.equal(items[0].translation, undefined);
});

test('fetchSource resolves rsshub routes against RSSHUB_BASE_URL', async () => {
  const requested = [];

  const items = await fetchSource(
    {
      id: 'bilibili-chimp',
      name: '第四种黑猩猩CHIMP',
      kind: 'rsshub',
      group: 'creator',
      path: '/bilibili/user/video/3546830396721763',
    },
    {
      rsshubBaseUrl: 'http://127.0.0.1:1200',
      fetchText: async (url) => {
        requested.push(url);
        return rssXml;
      },
    }
  );

  assert.deepEqual(requested, ['http://127.0.0.1:1200/bilibili/user/video/3546830396721763']);
  assert.equal(items[0].sourceName, '第四种黑猩猩CHIMP');
});

test('fetchSource passes source timeout to rsshub fetches', async () => {
  const initValues = [];

  await fetchSource(
    {
      id: 'xhs-zhangzala',
      name: '张咋啦',
      kind: 'rsshub',
      group: 'creator',
      path: '/xiaohongshu/user/59757acd50c4b45e6e9a90df/notes',
      timeoutMs: 90_000,
    },
    {
      rsshubBaseUrl: 'http://127.0.0.1:1200',
      fetchText: async (_url, init) => {
        initValues.push(init);
        return rssXml;
      },
    }
  );

  assert.deepEqual(initValues, [{ timeoutMs: 90_000 }]);
});

test('fetchSource retries RSSHub fallback paths when the primary route fails', async () => {
  const requested = [];

  const items = await fetchSource(
    {
      id: 'wechat-khazix',
      name: '数字生命卡兹克',
      kind: 'rsshub',
      group: 'creator',
      path: '/wechat/sogou/Rockhazix',
      fallbackPaths: ['/wechat/uread/Rockhazix'],
    },
    {
      rsshubBaseUrl: 'http://127.0.0.1:1200',
      fetchText: async (url) => {
        requested.push(url);
        if (url.includes('/wechat/sogou/')) {
          throw new Error('Sogou route failed');
        }
        return rssXml;
      },
    }
  );

  assert.deepEqual(requested, [
    'http://127.0.0.1:1200/wechat/sogou/Rockhazix',
    'http://127.0.0.1:1200/wechat/uread/Rockhazix',
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceName, '数字生命卡兹克');
});

test('fetchSource prefers an env-configured feed before RSSHub routes', async () => {
  const previous = process.env.WECHAT_KHAZIX_RSS_URL;
  const requested = [];
  process.env.WECHAT_KHAZIX_RSS_URL = 'http://127.0.0.1:8001/feeds/khazix.xml';

  try {
    const items = await fetchSource(
      {
        id: 'wechat-khazix',
        name: '数字生命卡兹克',
        kind: 'rsshub',
        group: 'creator',
        urlEnv: 'WECHAT_KHAZIX_RSS_URL',
        path: '/wechat/sogou/Rockhazix',
        fallbackPaths: ['/wechat/uread/Rockhazix'],
      },
      {
        rsshubBaseUrl: 'http://127.0.0.1:1200',
        fetchText: async (url) => {
          requested.push(url);
          return rssXml;
        },
      }
    );

    assert.deepEqual(requested, ['http://127.0.0.1:8001/feeds/khazix.xml']);
    assert.equal(items.length, 1);
    assert.equal(items[0].sourceName, '数字生命卡兹克');
  } finally {
    if (previous === undefined) {
      delete process.env.WECHAT_KHAZIX_RSS_URL;
    } else {
      process.env.WECHAT_KHAZIX_RSS_URL = previous;
    }
  }
});

test('fetchSource falls back to RSSHub when env-configured feed fails', async () => {
  const previous = process.env.WECHAT_KHAZIX_RSS_URL;
  const requested = [];
  process.env.WECHAT_KHAZIX_RSS_URL = 'http://127.0.0.1:8001/feeds/khazix.xml';

  try {
    const items = await fetchSource(
      {
        id: 'wechat-khazix',
        name: '数字生命卡兹克',
        kind: 'rsshub',
        group: 'creator',
        urlEnv: 'WECHAT_KHAZIX_RSS_URL',
        path: '/wechat/sogou/Rockhazix',
      },
      {
        rsshubBaseUrl: 'http://127.0.0.1:1200',
        fetchText: async (url) => {
          requested.push(url);
          if (url.includes(':8001')) {
            throw new Error('we-mp-rss feed not ready');
          }
          return rssXml;
        },
      }
    );

    assert.deepEqual(requested, [
      'http://127.0.0.1:8001/feeds/khazix.xml',
      'http://127.0.0.1:1200/wechat/sogou/Rockhazix',
    ]);
    assert.equal(items.length, 1);
  } finally {
    if (previous === undefined) {
      delete process.env.WECHAT_KHAZIX_RSS_URL;
    } else {
      process.env.WECHAT_KHAZIX_RSS_URL = previous;
    }
  }
});

test('fetchSource maps AI HOT selected and keyword responses', async () => {
  const urls = [];

  const items = await fetchSource(
    {
      id: 'aihot',
      name: 'AI HOT',
      kind: 'aihot',
      group: 'aihot',
      keywords: ['Codex'],
    },
    {
      now: new Date('2026-06-09T00:00:00.000Z'),
      fetchJson: async (url) => {
        urls.push(url);
        return {
          items: [
            {
              id: 'a1',
              title: 'Codex launches new automation features',
              titleZh: 'Codex 发布新的自动化能力',
              summary: 'Useful for AI coding workflows.',
              summaryZh: '适合 AI coding workflow。',
              url: 'https://aihot.example/items/a1',
              source: 'OpenAI',
              publishedAt: '2026-06-08T12:00:00.000Z',
              category: 'ai-products',
            },
          ],
        };
      },
    }
  );

  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes('mode=selected'));
  assert.ok(urls[1].includes('q=Codex'));
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceName, 'AI HOT');
  assert.equal(items[0].category, 'ai-products');
  assert.equal(items[0].title, 'Codex 发布新的自动化能力');
  assert.equal(items[0].originalTitle, 'Codex launches new automation features');
  assert.equal(items[0].translation.summary, '适合 AI coding workflow。');
});

test('fetchSource keeps AI HOT items when one subrequest fails', async () => {
  const calls = [];

  const items = await fetchSource(
    {
      id: 'aihot',
      name: 'AI HOT',
      kind: 'aihot',
      group: 'aihot',
      keywords: ['Codex'],
    },
    {
      now: new Date('2026-06-09T00:00:00.000Z'),
      fetchJson: async (url) => {
        calls.push(url);
        if (url.includes('mode=selected')) {
          throw new Error('ECONNRESET');
        }

        return {
          items: [
            {
              title: 'Codex 自动化实践',
              summary: '一个可用的 agent workflow。',
              url: 'https://aihot.example/items/codex',
              source: 'OpenAI',
              publishedAt: '2026-06-08T12:00:00.000Z',
              category: 'tip',
            },
          ],
        };
      },
    }
  );

  assert.equal(calls.filter((url) => url.includes('mode=selected')).length, 2);
  assert.equal(calls.filter((url) => url.includes('q=Codex')).length, 1);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Codex 自动化实践');
});

test('fetchSource requests AI HOT selected and keyword feeds concurrently', async () => {
  let activeRequests = 0;
  let maxActiveRequests = 0;

  await fetchSource(
    {
      id: 'aihot',
      name: 'AI HOT',
      kind: 'aihot',
      group: 'aihot',
      keywords: ['Codex', 'MCP'],
    },
    {
      now: new Date('2026-06-09T00:00:00.000Z'),
      fetchJson: async () => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeRequests -= 1;
        return { items: [] };
      },
    }
  );

  assert.equal(maxActiveRequests, 3);
});

test('fetchSource filters AI HOT items by publisher source field', async () => {
  const urls = [];

  const items = await fetchSource(
    {
      id: 'aihot-khazix',
      name: '卡兹克（AI HOT兜底）',
      kind: 'aihot',
      group: 'creator',
      url: 'https://aihot.virxact.com/api/public/items',
      mode: 'all',
      pageSize: 2,
      maxPages: 2,
      sourceIncludes: ['卡兹克', '数字生命', 'Khazix'],
    },
    {
      now: new Date('2026-06-10T00:00:00.000Z'),
      fetchJson: async (url) => {
        urls.push(url);
        if (!url.includes('cursor=')) {
          return {
            nextCursor: 'page-2',
            items: [
              {
                titleZh: 'Anthropic 发布 Claude Fable 5',
                summaryZh: '卡兹克转述的新模型更新。',
                url: 'https://x.com/Khazix0918/status/1',
                source: 'X：卡兹克 (@Khazix0918)',
                publishedAt: '2026-06-09T23:13:14.000Z',
                category: 'ai-models',
              },
              {
                titleZh: 'OpenAI 另一条新闻',
                url: 'https://example.com/openai',
                source: 'OpenAI',
                publishedAt: '2026-06-09T23:00:00.000Z',
              },
            ],
          };
        }

        return {
          items: [
            {
              titleZh: '数字生命卡兹克公众号文章',
              url: 'https://mp.weixin.qq.com/s?__biz=abc&mid=1&idx=1&sn=def',
              source: '公众号：数字生命卡兹克',
              publishedAt: '2026-06-09T21:03:45.000Z',
            },
          ],
        };
      },
    }
  );

  assert.equal(urls.length, 2);
  assert.equal(new URL(urls[0]).searchParams.get('mode'), 'all');
  assert.equal(new URL(urls[0]).searchParams.get('take'), '2');
  assert.equal(new URL(urls[0]).searchParams.get('since'), '2026-06-09T00:00:00.000Z');
  assert.equal(new URL(urls[1]).searchParams.get('cursor'), 'page-2');
  assert.deepEqual(
    items.map((item) => item.title),
    ['Anthropic 发布 Claude Fable 5', '数字生命卡兹克公众号文章']
  );
  assert.equal(items[0].sourceName, '卡兹克（AI HOT兜底）');
  assert.equal(items[0].group, 'creator');
  assert.equal(items[0].externalSource, 'X：卡兹克 (@Khazix0918)');
});

test('fetchSource keeps AI HOT source filters on items endpoint for target dates', async () => {
  const urls = [];

  const items = await fetchSource(
    {
      id: 'aihot-khazix',
      name: '卡兹克（AI HOT兜底）',
      kind: 'aihot',
      group: 'creator',
      url: 'https://aihot.virxact.com/api/public/items',
      sourceIncludes: ['卡兹克'],
    },
    {
      targetDate: '2026-06-08',
      fetchJson: async (url) => {
        urls.push(url);
        return {
          items: [
            {
              titleZh: '12个旗舰大模型参加高考',
              url: 'https://x.com/Khazix0918/status/2',
              source: 'X：卡兹克 (@Khazix0918)',
              publishedAt: '2026-06-08T04:35:19.000Z',
            },
          ],
        };
      },
    }
  );

  const url = new URL(urls[0]);
  assert.equal(url.pathname, '/api/public/items');
  assert.equal(url.searchParams.get('since'), '2026-06-07T16:00:00.000Z');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, '12个旗舰大模型参加高考');
});

test('fetchSource maps AI HOT daily response for target dates', async () => {
  const urls = [];

  const items = await fetchSource(
    {
      id: 'aihot',
      name: 'AI HOT',
      kind: 'aihot',
      group: 'aihot',
      url: 'https://aihot.virxact.com/api/public/items',
      keywords: ['Codex'],
    },
    {
      targetDate: '2026-06-08',
      fetchJson: async (url) => {
        urls.push(url);
        return {
          date: '2026-06-08',
          sections: [
            {
              label: '技巧与观点',
              items: [
                {
                  title: 'Harness 工程：在智能体优先的世界中运用 Codex',
                  summary: 'OpenAI Codex 实践文章。',
                  sourceUrl: 'https://openai.com/index/harness-engineering',
                  sourceName: 'OpenAI',
                },
              ],
            },
          ],
        };
      },
    }
  );

  assert.deepEqual(urls, ['https://aihot.virxact.com/api/public/daily/2026-06-08']);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Harness 工程：在智能体优先的世界中运用 Codex');
  assert.equal(items[0].category, '技巧与观点');
  assert.equal(items[0].externalSource, 'OpenAI');
});
