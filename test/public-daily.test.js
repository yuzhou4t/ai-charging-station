import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPublicDaily } from '../src/public-daily.js';

test('buildPublicDaily keeps reader content and removes local operational details', () => {
  const result = buildPublicDaily({
    date: '2026-08-08',
    generatedAt: '2026-08-07T23:55:00.000Z',
    timezone: 'Asia/Shanghai',
    windowLabel: '过去 24 小时',
    sourcesChecked: [{ id: 'creator', name: '创作者', group: 'creator' }],
    sourceHealth: {
      creator: {
        ok: false,
        fallback: true,
        count: 1,
        error: '读取 /Users/example/secret 失败',
      },
    },
    items: [{ id: 'one' }],
    sections: {
      mustRead: [
        {
          id: 'one',
          title: 'Original title',
          summary: 'Original summary',
          translation: { title: '中文标题', summary: '中文摘要' },
          sourceId: 'creator',
          sourceName: '创作者',
          url: 'https://example.com/item',
          publishedAt: '2026-08-07T10:00:00.000Z',
        },
      ],
    },
    editorNotes: ['本机路径 /Users/example/private'],
    reportPath: '/Users/example/private/report.txt',
  });

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.sections.mustRead[0].title, '中文标题');
  assert.equal(result.summary.sources[0].status, 'fallback');
  assert.equal(result.summary.sources[0].itemCount, 1);
  assert.doesNotMatch(JSON.stringify(result), /\/Users\/example|editorNotes|reportPath|error/);
});

test('buildPublicDaily requires a dated digest', () => {
  assert.throws(() => buildPublicDaily({}), /缺少 date/);
});
