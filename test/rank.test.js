import test from 'node:test';
import assert from 'node:assert/strict';

import { rankItems } from '../src/rank.js';

test('rankItems uses AI HOT feedback to lower disliked topics without hiding the whole category', () => {
  const now = new Date('2026-06-10T00:00:00.000Z');
  const feedback = {
    items: [
      {
        title: 'Browser automation cookbook',
        url: 'https://old.example.com/browser-automation',
        rating: 'good',
        tags: ['browser automation'],
      },
      {
        title: 'Do not show this again',
        url: 'https://example.com/hidden',
        rating: 'hide',
      },
      {
        title: 'Policy noise',
        url: 'https://old.example.com/policy-noise',
        rating: 'down',
        tags: ['policy memo'],
      },
    ],
  };

  const ranked = rankItems(
    [
      {
        id: 'baseline',
        sourceId: 'aihot',
        sourceName: 'AI HOT',
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
        group: 'aihot',
        title: 'Do not show this again',
        url: 'https://example.com/hidden',
        summary: 'This item should be hidden by feedback.',
        publishedAt: '2026-06-09T23:00:00.000Z',
      },
      {
        id: 'hidden-topic',
        sourceId: 'aihot',
        sourceName: 'AI HOT',
        group: 'aihot',
        title: 'AI policy memo roundup',
        url: 'https://example.com/policy-roundup',
        summary: 'A policy memo collection that should be lowered by feedback tags.',
        publishedAt: '2026-06-09T23:00:00.000Z',
      },
    ],
    now,
    feedback
  );

  assert.deepEqual(
    ranked.map((item) => item.id),
    ['liked-topic', 'baseline', 'hidden-topic']
  );
  assert.equal(ranked.find((item) => item.id === 'hidden-topic').score, 26);
});
