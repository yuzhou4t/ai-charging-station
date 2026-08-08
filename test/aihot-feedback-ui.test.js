import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFeedbackPayload,
  buildFeedbackCommand,
  feedbackItemKey,
  isAiHotFeedbackItem,
  updateFeedbackState,
} from '../web/src/aihotFeedback.js';

test('isAiHotFeedbackItem only enables controls for AI HOT items', () => {
  assert.equal(isAiHotFeedbackItem({ sourceId: 'aihot', group: 'aihot' }), true);
  assert.equal(isAiHotFeedbackItem({ sourceId: 'langchain-blog', group: 'official' }), false);
});

test('buildFeedbackCommand creates a CLI command for persistent feedback', () => {
  const command = buildFeedbackCommand(
    {
      id: 'aihot-abc123',
      title: 'Browser automation patterns',
      url: 'https://example.com/browser',
      category: 'workflow',
      externalSource: 'X：Browser Lab',
    },
    'down'
  );

  assert.equal(command, 'npm run feedback -- --rating=down --url=https://example.com/browser --tags="workflow,X：Browser Lab"');
});

test('updateFeedbackState stores one compact feedback record per item', () => {
  const item = {
    id: 'aihot-abc123',
    title: 'Browser automation patterns',
    url: 'https://example.com/browser',
  };
  const state = updateFeedbackState({}, item, 'good', new Date('2026-06-10T10:00:00.000Z'));

  assert.deepEqual(state, {
    [feedbackItemKey(item)]: {
      rating: 'good',
      command: 'npm run feedback -- --rating=good --url=https://example.com/browser',
      updatedAt: '2026-06-10T10:00:00.000Z',
    },
  });
});

test('buildFeedbackPayload carries type tags for future ranking adjustments', () => {
  const payload = buildFeedbackPayload(
    {
      title: 'Browser automation patterns',
      url: 'https://example.com/browser',
      sourceId: 'aihot',
      sourceName: 'AI HOT',
      category: 'workflow',
      externalSource: 'X：Browser Lab',
    },
    'down'
  );

  assert.deepEqual(payload, {
    title: 'Browser automation patterns',
    url: 'https://example.com/browser',
    sourceId: 'aihot',
    sourceName: 'AI HOT',
    rating: 'down',
    tags: ['workflow', 'X：Browser Lab'],
  });
});
