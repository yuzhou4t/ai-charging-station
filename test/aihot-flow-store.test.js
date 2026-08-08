import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { mergeAiHotFlowStore, recordFlowFeedback } from '../src/aihot-flow-store.js';

test('mergeAiHotFlowStore prunes old unprotected items and keeps saved or daily items', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aihot-flow-'));
  const storePath = join(dir, 'aihot-items.json');
  const feedbackPath = join(dir, 'feedback.json');
  const digestDir = join(dir, 'digests');
  const now = new Date('2026-06-21T12:00:00.000Z');

  await writeFile(
    storePath,
    JSON.stringify({
      items: [
        oldItem('drop', 'https://example.com/drop'),
        oldItem('saved', 'https://example.com/saved'),
        oldItem('daily', 'https://example.com/daily'),
      ],
    }),
    'utf8'
  );
  await mkdir(digestDir, { recursive: true });
  await writeFile(join(digestDir, '2026-06-01.json'), JSON.stringify({ items: [{ title: 'daily', url: 'https://example.com/daily' }] }), 'utf8');

  await recordFlowFeedback(feedbackPath, {
    item: { title: 'saved', url: 'https://example.com/saved' },
    saved: true,
  }, now);

  const result = await mergeAiHotFlowStore({
    storePath,
    incomingItems: [{ title: 'fresh', url: 'https://example.com/fresh', publishedAt: '2026-06-21T10:00:00.000Z' }],
    feedbackPath,
    digestDir,
    now,
    retentionDays: 30,
  });

  assert.equal(result.stats.pruned, 1);
  assert.deepEqual(
    result.items.map((item) => item.title).sort(),
    ['daily', 'fresh', 'saved']
  );
  assert.deepEqual(result.items.find((item) => item.title === 'saved').protectedReasons, ['saved']);
  assert.deepEqual(result.items.find((item) => item.title === 'daily').protectedReasons, ['daily']);
});

function oldItem(title, url) {
  return {
    id: title,
    title,
    url,
    publishedAt: '2026-05-01T00:00:00.000Z',
    firstSeenAt: '2026-05-01T00:00:00.000Z',
    lastSeenAt: '2026-05-01T00:00:00.000Z',
  };
}
