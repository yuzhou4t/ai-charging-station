import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDigestReport } from '../src/report.js';

test('formatDigestReport prints items, summaries, links, and source issues', () => {
  const report = formatDigestReport({
    date: '2026-06-10',
    sourceHealth: {
      ok: { ok: true },
      fallback: { ok: false, fallback: true },
    },
    items: [{ id: '1' }, { id: '2' }],
    sections: {
      mustRead: [
        {
          title: 'OpenAI 官方 Prompt 工作流',
          sourceName: '数字生命卡兹克',
          externalSource: 'ForgeRSS',
          summary: '讲如何把重复工作沉淀成 skill 和自动化。',
          url: 'https://example.com/prompt',
          translation: {
            title: 'OpenAI 官方提示词工作流',
            summary: '',
          },
        },
      ],
      creatorUpdates: [],
      officialUpdates: [],
      aihotPicks: [],
      publisherGroups: [
        {
          name: 'ForgeRSS',
          itemCount: 1,
          items: [
            {
              title: 'OpenAI 官方 Prompt 工作流',
              category: 'creator',
              translation: {
                title: 'OpenAI 官方提示词工作流',
                summary: '',
              },
            },
          ],
        },
      ],
      sourceStatus: [
        { name: '数字生命卡兹克', ok: false, fallback: true, itemCount: 7, error: '安全验证' },
      ],
    },
  });

  assert.match(report, /AI充电站 2026-06-10 内容摘要/);
  assert.match(report, /发布者概览/);
  assert.match(report, /ForgeRSS：1 条/);
  assert.match(report, /OpenAI 官方提示词工作流/);
  assert.match(report, /讲了：讲如何把重复工作沉淀成 skill 和自动化。/);
  assert.match(report, /链接：https:\/\/example.com\/prompt/);
  assert.match(report, /FALLBACK 数字生命卡兹克，已用 7 条兜底新增：安全验证/);
});
