import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildDigest, writeDigest } from '../src/digest.js';
import { dedupeItems } from '../src/rank.js';

const fixedNow = new Date('2026-06-09T00:15:00.000Z');

test('buildDigest records source failures without blocking successful sources', async () => {
  const sources = [
    { id: 'ok', name: 'Working Creator', kind: 'test', group: 'creator' },
    { id: 'bad', name: 'Broken RSSHub', kind: 'test', group: 'creator', configHint: '需要配置 TOKEN。' },
  ];

  const digest = await buildDigest({
    sources,
    now: fixedNow,
    fetchSource: async (source) => {
      if (source.id === 'bad') {
        throw new Error('RSSHub unavailable');
      }

      return [
        {
          id: 'ok-1',
          sourceId: source.id,
          sourceName: source.name,
          group: 'creator',
          title: '用 agent 管理一人公司',
          url: 'https://example.com/agent-company',
          summary: '一个创作者更新。',
          publishedAt: '2026-06-08T23:00:00.000Z',
        },
      ];
    },
  });

  assert.equal(digest.date, '2026-06-09');
  assert.equal(digest.sourceHealth.ok.ok, true);
  assert.equal(digest.sourceHealth.bad.ok, false);
  assert.match(digest.sourceHealth.bad.error, /RSSHub unavailable/);
  assert.match(digest.sourceHealth.bad.error, /需要配置 TOKEN/);
  assert.equal(digest.items.length, 1);
  assert.equal(digest.sections.creatorUpdates.length, 1);
  assert.ok(digest.editorNotes.some((note) => note.includes('Broken RSSHub')));
});

test('buildDigest can target a specific Beijing date and filters to items belonging to that day', async () => {
  const digest = await buildDigest({
    sources: [{ id: 'ok', name: 'Working Creator', kind: 'test', group: 'creator' }],
    now: fixedNow,
    targetDate: '2026-06-08',
    fetchSource: async () => [
      {
        id: 'in-window',
        sourceId: 'ok',
        sourceName: 'Working Creator',
        group: 'creator',
        title: '昨天的 AI 更新',
        url: 'https://example.com/yesterday',
        summary: '应该进入 6 月 8 日日报。',
        publishedAt: '2026-06-08T10:00:00.000+08:00',
      },
      {
        id: 'out-window',
        sourceId: 'ok',
        sourceName: 'Working Creator',
        group: 'creator',
        title: '今天的 AI 更新',
        url: 'https://example.com/today',
        summary: '不应该进入 6 月 8 日日报。',
        publishedAt: '2026-06-09T10:00:00.000+08:00',
      },
      {
        id: 'undated',
        sourceId: 'ok',
        sourceName: 'Working Creator',
        group: 'creator',
        title: '无日期的静态页面',
        url: 'https://example.com/static',
        summary: '无日期内容不应该混入指定日期日报。',
      },
      {
        id: 'daily-owned',
        sourceId: 'ok',
        sourceName: 'Working Creator',
        group: 'aihot',
        title: 'AI HOT 指定日期日报条目',
        url: 'https://example.com/daily',
        summary: '明确属于 6 月 8 日。',
        targetDate: '2026-06-08',
      },
    ],
  });

  assert.equal(digest.date, '2026-06-08');
  assert.deepEqual(
    digest.items.map((item) => item.id).sort(),
    ['daily-owned', 'in-window']
  );
  assert.ok(digest.editorNotes.some((note) => note.includes('过滤')));
});

test('buildDigest skips sources inside their minimum fetch interval', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-state-'));
  const sourceStatePath = join(outputDir, 'source-state.json');

  try {
    await writeFile(
      sourceStatePath,
      JSON.stringify({
        xhs: {
          lastAttemptAt: '2026-06-08T23:30:00.000Z',
          lastOk: false,
          lastItemCount: 0,
          lastError: 'security verification',
        },
      })
    );

    const digest = await buildDigest({
      sources: [{ id: 'xhs', name: '小红书源', kind: 'rsshub', group: 'creator', minIntervalHours: 24 }],
      now: fixedNow,
      sourceStatePath,
      fetchSource: async () => {
        throw new Error('fetchSource should not be called');
      },
    });

    assert.equal(digest.sourceHealth.xhs.ok, false);
    assert.equal(digest.sourceHealth.xhs.skipped, true);
    assert.match(digest.sourceHealth.xhs.error, /24 小时内最多请求一次/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('buildDigest records fetch attempts in source state', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-state-'));
  const sourceStatePath = join(outputDir, 'source-state.json');

  try {
    await buildDigest({
      sources: [{ id: 'xhs', name: '小红书源', kind: 'rsshub', group: 'creator', minIntervalHours: 24 }],
      now: fixedNow,
      sourceStatePath,
      fetchSource: async () => [
        {
          id: 'xhs-1',
          sourceId: 'xhs',
          sourceName: '小红书源',
          group: 'creator',
          title: '一次小红书更新',
          url: 'https://example.com/xhs',
          publishedAt: '2026-06-08T23:00:00.000Z',
        },
      ],
    });

    const state = JSON.parse(await readFile(sourceStatePath, 'utf8'));
    assert.equal(state.xhs.lastAttemptAt, fixedNow.toISOString());
    assert.equal(state.xhs.lastOk, true);
    assert.equal(state.xhs.lastItemCount, 0);
    assert.equal(state.xhs.lastSuccessfulItems.length, 1);
    assert.equal(state.xhs.lastSuccessfulItems[0].title, '一次小红书更新');
    assert.deepEqual(state.seenItems.xhs.keys, ['url:https://example.com/xhs']);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('buildDigest with source state only reports unseen items from the previous 24 hours', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-seen-'));
  const sourceStatePath = join(outputDir, 'source-state.json');

  try {
    await writeFile(
      sourceStatePath,
      JSON.stringify({
        seenItems: {
          creator: {
            keys: ['url:https://example.com/already-seen'],
            updatedAt: '2026-06-08T00:00:00.000Z',
          },
        },
      })
    );

    const digest = await buildDigest({
      sources: [{ id: 'creator', name: '创作者', platform: 'rss', kind: 'test', group: 'creator' }],
      now: new Date('2026-06-10T00:00:00.000Z'),
      sourceStatePath,
      fetchSource: async () => [
        {
          id: 'seen',
          sourceId: 'creator',
          sourceName: '创作者',
          group: 'creator',
          title: '已经推过的内容',
          url: 'https://example.com/already-seen',
          summary: '这条不应该重复推送。',
          publishedAt: '2026-06-09T23:00:00.000Z',
        },
        {
          id: 'fresh',
          sourceId: 'creator',
          sourceName: '创作者',
          group: 'creator',
          title: '过去 24 小时的新内容',
          url: 'https://example.com/fresh',
          summary: '这条应该进入日报。',
          publishedAt: '2026-06-09T22:00:00.000Z',
        },
        {
          id: 'old',
          sourceId: 'creator',
          sourceName: '创作者',
          group: 'creator',
          title: '很久以前的内容',
          url: 'https://example.com/old',
          summary: '这条太旧了。',
          publishedAt: '2026-06-08T00:00:00.000Z',
        },
      ],
    });

    assert.deepEqual(
      digest.items.map((item) => item.id),
      ['fresh']
    );
    assert.equal(digest.sourceHealth.creator.itemCount, 1);
    assert.equal(digest.sourceHealth.creator.fetchedCount, 3);
    assert.equal(digest.sourceHealth.creator.seenSkippedCount, 1);

    const state = JSON.parse(await readFile(sourceStatePath, 'utf8'));
    assert.ok(state.seenItems.creator.keys.includes('url:https://example.com/fresh'));
    assert.ok(state.seenItems.creator.keys.includes('url:https://example.com/old'));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('buildDigest bootstraps seen state without pushing existing backlog', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-bootstrap-'));
  const sourceStatePath = join(outputDir, 'source-state.json');

  try {
    const digest = await buildDigest({
      sources: [{ id: 'creator', name: '创作者', platform: 'rss', kind: 'test', group: 'creator' }],
      now: new Date('2026-06-10T00:00:00.000Z'),
      sourceStatePath,
      fetchSource: async () => [
        {
          id: 'backlog',
          sourceId: 'creator',
          sourceName: '创作者',
          group: 'creator',
          title: '初次接入时已有的历史内容',
          url: 'https://example.com/backlog',
          summary: '这条用来建立基线。',
          publishedAt: '2026-06-09T23:00:00.000Z',
        },
      ],
    });

    assert.equal(digest.items.length, 0);
    assert.equal(digest.sourceHealth.creator.bootstrap, true);
    assert.ok(digest.editorNotes.some((note) => note.includes('建立已读基线')));

    const state = JSON.parse(await readFile(sourceStatePath, 'utf8'));
    assert.deepEqual(state.seenItems.creator.keys, ['url:https://example.com/backlog']);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('buildDigest keeps oversized RSS baselines from reposting existing items', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-large-feed-'));
  const sourceStatePath = join(outputDir, 'source-state.json');
  const source = { id: 'openai-news', name: 'OpenAI News', platform: 'official-blog', kind: 'rss', group: 'official' };
  const items = Array.from({ length: 1005 }, (_, index) => ({
    id: `openai-news-${index}`,
    sourceId: source.id,
    sourceName: source.name,
    group: source.group,
    title: `OpenAI News item ${index}`,
    url: `https://openai.com/index/item-${index}`,
    publishedAt: '2026-06-09T23:00:00.000Z',
  }));

  try {
    const firstDigest = await buildDigest({
      sources: [source],
      now: new Date('2026-06-10T00:00:00.000Z'),
      sourceStatePath,
      fetchSource: async () => items,
    });
    const secondDigest = await buildDigest({
      sources: [source],
      now: new Date('2026-06-10T00:05:00.000Z'),
      sourceStatePath,
      fetchSource: async () => items,
    });

    assert.equal(firstDigest.items.length, 0);
    assert.equal(secondDigest.items.length, 0);

    const state = JSON.parse(await readFile(sourceStatePath, 'utf8'));
    assert.equal(state.seenItems['openai-news'].keys.length, 1005);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('buildDigest uses manual links and cached items when a source fails', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-fallback-'));
  const sourceStatePath = join(outputDir, 'source-state.json');
  const manualLinksPath = join(outputDir, 'manual-links.json');

  try {
    await writeFile(
      sourceStatePath,
      JSON.stringify({
        seenItems: {
          xhs: {
            keys: [],
            updatedAt: '2026-06-08T00:00:00.000Z',
          },
        },
        xhs: {
          lastAttemptAt: '2026-06-08T20:00:00.000Z',
          lastOk: true,
          lastItemCount: 1,
          lastSuccessfulItems: [
            {
              id: 'cached-note',
              sourceId: 'xhs',
              sourceName: '小红书源',
              platform: 'xiaohongshu',
              group: 'creator',
              title: '缓存里的小红书更新',
              url: 'https://www.xiaohongshu.com/explore/cached',
              summary: '来自最近一次成功抓取。',
              publishedAt: '2026-06-08T22:00:00.000Z',
            },
          ],
        },
      })
    );
    await writeFile(
      manualLinksPath,
      JSON.stringify({
        xhs: [
          {
            title: '手动补进来的小红书链接',
            url: 'https://www.xiaohongshu.com/explore/manual',
            summary: '人工确认值得收录。',
            publishedAt: '2026-06-08T23:00:00.000Z',
          },
        ],
      })
    );

    const digest = await buildDigest({
      sources: [{ id: 'xhs', name: '小红书源', platform: 'xiaohongshu', kind: 'rsshub', group: 'creator', minIntervalHours: 0.5 }],
      now: fixedNow,
      sourceStatePath,
      manualLinksPath,
      fetchSource: async () => {
        throw new Error('security verification');
      },
    });

    assert.equal(digest.sourceHealth.xhs.ok, false);
    assert.equal(digest.sourceHealth.xhs.fallback, true);
    assert.equal(digest.sourceHealth.xhs.itemCount, 2);
    assert.equal(digest.sections.sourceStatus[0].fallback, true);
    assert.deepEqual(
      digest.items.map((item) => item.title),
      ['手动补进来的小红书链接', '缓存里的小红书更新']
    );
    assert.deepEqual(
      digest.items.map((item) => item.externalSource),
      ['手动补链', '最近成功缓存']
    );
    assert.ok(digest.editorNotes.some((note) => note.includes('已使用 2 条兜底新增')));

    const state = JSON.parse(await readFile(sourceStatePath, 'utf8'));
    assert.equal(state.xhs.lastOk, false);
    assert.equal(state.xhs.lastSuccessfulItems.length, 1);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('buildDigest uses local ForgeRSS feed when a source fails', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-forgerss-'));
  const sourceStatePath = join(outputDir, 'source-state.json');
  const forgeRssPath = join(outputDir, 'xhs-zhangzala.xml');

  try {
    await writeFile(
      sourceStatePath,
      JSON.stringify({
        seenItems: {
          'xhs-zhangzala': {
            keys: [],
            updatedAt: '2026-06-08T00:00:00.000Z',
          },
        },
      })
    );
    await writeFile(
      forgeRssPath,
      `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[张咋啦的新小红书笔记]]></title>
    <link>https://www.xiaohongshu.com/explore/forgerss-note</link>
    <description><![CDATA[ForgeRSS 抓到的创作者更新。]]></description>
    <pubDate>Mon, 08 Jun 2026 23:30:00 GMT</pubDate>
  </item>
</channel></rss>`
    );

    const digest = await buildDigest({
      sources: [
        {
          id: 'xhs-zhangzala',
          name: '张咋啦',
          platform: 'xiaohongshu',
          kind: 'rsshub',
          group: 'creator',
          forgeRssPath,
          minIntervalHours: 0.5,
        },
      ],
      now: fixedNow,
      sourceStatePath,
      fetchSource: async () => {
        throw new Error('RSSHub xhs failed');
      },
    });

    assert.equal(digest.sourceHealth['xhs-zhangzala'].ok, false);
    assert.equal(digest.sourceHealth['xhs-zhangzala'].fallback, true);
    assert.equal(digest.sourceHealth['xhs-zhangzala'].itemCount, 1);
    assert.equal(digest.items[0].title, '张咋啦的新小红书笔记');
    assert.equal(digest.items[0].externalSource, 'ForgeRSS');
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('buildDigest reads AI HOT feedback when ranking digest items', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-feedback-digest-'));
  const feedbackPath = join(outputDir, 'items.json');

  try {
    await writeFile(
      feedbackPath,
      JSON.stringify({
        items: [
          {
            title: 'Browser automation cookbook',
            url: 'https://old.example.com/browser-automation',
            rating: 'good',
            tags: ['browser automation'],
          },
          {
            title: 'AI HOT 噪音项',
            url: 'https://example.com/hidden',
            rating: 'hide',
          },
        ],
      })
    );

    const digest = await buildDigest({
      sources: [{ id: 'aihot', name: 'AI HOT', platform: 'aihot', kind: 'test', group: 'aihot' }],
      now: new Date('2026-06-10T00:00:00.000Z'),
      feedbackPath,
      fetchSource: async () => [
        {
          id: 'baseline',
          sourceId: 'aihot',
          sourceName: 'AI HOT',
          platform: 'aihot',
          group: 'aihot',
          title: 'GPT agent MCP launch',
          url: 'https://example.com/baseline',
          summary: 'OpenAI agent workflow update.',
          publishedAt: '2026-06-09T23:00:00.000Z',
        },
        {
          id: 'liked-topic',
          sourceId: 'aihot',
          sourceName: 'AI HOT',
          platform: 'aihot',
          group: 'aihot',
          title: 'Browser automation patterns for daily research',
          url: 'https://example.com/browser-automation-patterns',
          summary: 'A practical browser automation workflow.',
          publishedAt: '2026-06-09T23:00:00.000Z',
        },
        {
          id: 'hidden',
          sourceId: 'aihot',
          sourceName: 'AI HOT',
          platform: 'aihot',
          group: 'aihot',
          title: 'AI HOT 噪音项',
          url: 'https://example.com/hidden',
          summary: '这条应该被用户反馈隐藏。',
          publishedAt: '2026-06-09T23:00:00.000Z',
        },
      ],
    });

    assert.deepEqual(
      digest.items.map((item) => item.id),
      ['liked-topic', 'baseline']
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('dedupeItems removes duplicate urls and near-identical titles', () => {
  const items = [
    { id: 'a', title: 'OpenAI 发布新的 Codex 功能', url: 'https://example.com/a', score: 10 },
    { id: 'b', title: 'OpenAI发布新的Codex功能', url: 'https://example.com/b', score: 9 },
    { id: 'c', title: 'LangChain 发布 agent 沙盒', url: 'https://example.com/a', score: 8 },
    { id: 'd', title: '张咋啦：每天动手玩一小时 AI', url: 'https://example.com/d', score: 7 },
  ];

  const deduped = dedupeItems(items);

  assert.deepEqual(
    deduped.map((item) => item.id),
    ['a', 'd']
  );
});

test('dedupeItems keeps distinct WeChat articles with stable query identities', () => {
  const items = [
    {
      id: 'wx-a',
      title: '第一篇公众号文章',
      url: 'https://mp.weixin.qq.com/s?__biz=abc&mid=1&idx=1&sn=aaa&chksm=tracking',
    },
    {
      id: 'wx-b',
      title: '第二篇公众号文章',
      url: 'https://mp.weixin.qq.com/s?__biz=abc&mid=2&idx=1&sn=bbb',
    },
    {
      id: 'wx-a-dup',
      title: '第一篇公众号文章的重复链接',
      url: 'https://mp.weixin.qq.com/s?__biz=abc&mid=1&idx=1&sn=aaa&scene=21',
    },
  ];

  const deduped = dedupeItems(items);

  assert.deepEqual(
    deduped.map((item) => item.id),
    ['wx-a', 'wx-b']
  );
});

test('writeDigest emits frontend JSON, markdown, and latest pointer', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-'));

  try {
    const digest = await buildDigest({
      sources: [{ id: 'ok', name: 'Working Creator', kind: 'test', group: 'creator' }],
      now: fixedNow,
      fetchSource: async () => [
        {
          id: 'ok-1',
          sourceId: 'ok',
          sourceName: 'Working Creator',
          group: 'creator',
          title: 'Give your agent its own computer',
          url: 'https://example.com/skill',
          summary: 'Running code execution in an AI agent is harder than it looks.',
          publishedAt: '2026-06-08T22:00:00.000Z',
          translation: {
            title: '给你的智能体一台属于自己的计算机',
            summary: '在 AI 智能体里运行代码执行能力比看起来更难。',
            source: 'external-api',
          },
        },
      ],
    });

    const paths = await writeDigest(digest, outputDir);
    const json = JSON.parse(await readFile(paths.jsonPath, 'utf8'));
    const markdown = await readFile(paths.markdownPath, 'utf8');
    const latest = JSON.parse(await readFile(join(outputDir, 'latest.json'), 'utf8'));

    assert.equal(json.date, '2026-06-09');
    assert.ok(Array.isArray(json.sourcesChecked));
    assert.ok(Array.isArray(json.sections.mustRead));
    assert.equal(json.sections.publisherGroups[0].name, 'Working Creator');
    assert.equal(json.sections.publisherGroups[0].itemCount, 1);
    assert.match(markdown, /# AI充电站 2026-06-09/);
    assert.match(markdown, /今日必看/);
    assert.match(markdown, /发布者概览/);
    assert.match(markdown, /\[给你的智能体一台属于自己的计算机\]\(https:\/\/example.com\/skill\)/);
    assert.match(markdown, /在 AI 智能体里运行代码执行能力比看起来更难。/);
    assert.equal(latest.date, '2026-06-09');
    assert.equal(latest.json, 'digests/2026-06-09.json');
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('writeDigest drops legacy local glossary translations from frontend output', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-translation-'));

  try {
    const digest = await buildDigest({
      sources: [{ id: 'ok', name: 'Working Creator', kind: 'test', group: 'official' }],
      now: fixedNow,
      fetchSource: async () => [
        {
          id: 'ok-1',
          sourceId: 'ok',
          sourceName: 'Working Creator',
          group: 'official',
          title: 'Introducing Rubrics: Build Agents that Evaluate and Correct Their Work',
          url: 'https://example.com/rubrics',
          summary:
            "Deep Agents' RubricMiddleware adds a self-evaluation loop to your agent runs. Set a rubric, configure a grader, and get reliable outputs on tasks where correctness matters.",
          publishedAt: '2026-06-08T22:00:00.000Z',
          translation: {
            title: 'Introducing Rubrics: 构建 智能体s that Evaluate and Correct Their Work',
            summary: "Deep 智能体s' RubricMiddleware adds a self-evaluation loop.",
            source: 'local-glossary',
          },
        },
      ],
    });

    const paths = await writeDigest(digest, outputDir);
    const json = JSON.parse(await readFile(paths.jsonPath, 'utf8'));
    const markdown = await readFile(paths.markdownPath, 'utf8');

    assert.equal(json.items[0].translation, undefined);
    assert.doesNotMatch(markdown, /智能体s/);
    assert.doesNotMatch(markdown, /中文辅助：/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('writeDigest can preserve existing same-day items on rolling reruns', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-preserve-'));

  try {
    await writeDigest(
      {
        date: '2026-06-10',
        generatedAt: '2026-06-10T00:00:00.000Z',
        timezone: 'Asia/Shanghai',
        sourcesChecked: [{ id: 'aihot', name: 'AI HOT', platform: 'aihot', group: 'aihot' }],
        sourceHealth: { aihot: { ok: true, itemCount: 1 } },
        items: [
          {
            id: 'already-written',
            sourceId: 'aihot',
            sourceName: 'AI HOT',
            platform: 'aihot',
            group: 'aihot',
            title: '已经写入当天日报的 AI HOT',
            url: 'https://example.com/already-written',
            summary: '手动重跑不应该把它清掉。',
          },
        ],
        sections: {
          mustRead: [],
          creatorUpdates: [],
          officialUpdates: [],
          aihotPicks: [],
          sourceStatus: [],
        },
        editorNotes: [],
      },
      outputDir
    );

    await writeDigest(
      {
        date: '2026-06-10',
        generatedAt: '2026-06-10T01:00:00.000Z',
        timezone: 'Asia/Shanghai',
        sourcesChecked: [{ id: 'aihot', name: 'AI HOT', platform: 'aihot', group: 'aihot' }],
        sourceHealth: { aihot: { ok: true, itemCount: 0 } },
        items: [],
        sections: {
          mustRead: [],
          creatorUpdates: [],
          officialUpdates: [],
          aihotPicks: [],
          sourceStatus: [],
        },
        editorNotes: [],
      },
      outputDir,
      { preserveExistingItems: true }
    );

    const json = JSON.parse(await readFile(join(outputDir, 'digests/2026-06-10.json'), 'utf8'));
    assert.deepEqual(
      json.items.map((item) => item.id),
      ['already-written']
    );
    assert.deepEqual(
      json.sections.aihotPicks.map((item) => item.id),
      ['already-written']
    );
    assert.ok(json.editorNotes.some((note) => note.includes('保留同日已生成的 1 条内容')));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
