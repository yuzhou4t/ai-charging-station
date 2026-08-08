import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReadableTranslation, normalizeReadableTranslation, shouldTranslateTextBlock } from '../src/translation.js';

test('buildReadableTranslation skips short English labels without a long English block', () => {
  const translation = buildReadableTranslation({
    title: 'Give your agent its own computer',
    summary: '',
  });

  assert.equal(translation, null);
});

test('buildReadableTranslation skips Chinese copy that only contains English product terms', () => {
  const translation = buildReadableTranslation({
    title: 'OpenAI Codex 发布 Python SDK，可直接嵌入应用',
    summary: 'Claude Code 新增动态 workflow，适合 agent 编程场景。',
  });

  assert.equal(translation, null);
});

test('shouldTranslateTextBlock detects long English article blocks for external pretranslation', () => {
  assert.equal(
    shouldTranslateTextBlock({
      title: 'Everything we shipped at Interrupt',
      summary:
        "From autonomous debugging to one-line deploys, here's every product LangChain launched at Interrupt 2026 to help teams build, test, and ship agents in production.",
    }),
    true
  );
});

test('shouldTranslateTextBlock detects short Claude Blog titles with the placeholder summary', () => {
  assert.equal(
    shouldTranslateTextBlock({
      title: 'Run Claude Code sessions on your own compute',
      summary: 'Claude Blog update',
    }),
    true
  );
});

test('buildReadableTranslation does not synthesize local glossary translations', () => {
  const translation = buildReadableTranslation({
    title: 'Everything we shipped at Interrupt',
    summary:
      "From autonomous debugging to one-line deploys, here's every product LangChain launched at Interrupt 2026 to help teams build, test, and ship agents in production.",
  });

  assert.equal(translation, null);
});

test('buildReadableTranslation keeps provided trusted translations', () => {
  const translation = buildReadableTranslation({
    providedTitle: '我们在 Interrupt 发布的全部内容',
    providedSummary: '从自主调试到一行部署，这里汇总了 LangChain 在 Interrupt 2026 发布的全部产品。',
    source: 'external-api',
  });

  assert.deepEqual(translation, {
    title: '我们在 Interrupt 发布的全部内容',
    summary: '从自主调试到一行部署，这里汇总了 LangChain 在 Interrupt 2026 发布的全部产品。',
    source: 'external-api',
  });
});

test('normalizeReadableTranslation rejects old local glossary translations', () => {
  const translation = normalizeReadableTranslation({
    title: 'Introducing Rubrics: 构建 智能体s that Evaluate and Correct Their Work',
    summary: 'Deep 智能体s adds a self-evaluation loop.',
    source: 'local-glossary',
  });

  assert.equal(translation, null);
});
