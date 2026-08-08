import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { recordItemFeedback } from '../src/feedback.js';

test('recordItemFeedback upserts local item ratings for frontend reuse', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-feedback-'));
  const feedbackPath = join(outputDir, 'items.json');

  try {
    const now = new Date('2026-06-10T08:00:00.000+08:00');
    await recordItemFeedback(
      feedbackPath,
      {
        title: 'Codex 自动化日报实践',
        url: 'https://example.com/codex-digest',
        sourceId: 'aihot',
        sourceName: 'AI HOT',
        rating: 'good',
        tags: ['codex', 'automation'],
        note: '很贴近日常工作流。',
      },
      now
    );
    await recordItemFeedback(
      feedbackPath,
      {
        title: 'Codex 自动化日报实践',
        url: 'https://example.com/codex-digest',
        sourceId: 'aihot',
        sourceName: 'AI HOT',
        rating: 'down',
      },
      new Date('2026-06-10T08:05:00.000+08:00')
    );

    const saved = JSON.parse(await readFile(feedbackPath, 'utf8'));
    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0].rating, 'down');
    assert.equal(saved.items[0].url, 'https://example.com/codex-digest');
    assert.equal(saved.items[0].updatedAt, '2026-06-10T00:05:00.000Z');
    assert.deepEqual(saved.items[0].tags, []);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
