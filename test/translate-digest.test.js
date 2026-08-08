import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDigestTranslations,
  createExternalTranslator,
  findPendingTranslationItems,
  hasExternalTranslatorConfig,
} from '../src/translate-digest.js';

test('applyDigestTranslations translates only long English items without trusted translations', async () => {
  const calls = [];
  const digest = {
    date: '2026-06-09',
    items: [
      {
        id: 'english-long',
        title: 'Introducing Rubrics: Build Agents that Evaluate and Correct Their Work',
        summary:
          "Deep Agents' RubricMiddleware adds a self-evaluation loop to your agent runs. Set a rubric, configure a grader, and get reliable outputs on tasks where correctness matters.",
      },
      {
        id: 'mixed-cn',
        title: 'OpenAI Codex 发布 Python SDK',
        summary: 'Claude Code 新增 workflow，适合 agent 编程场景。',
      },
      {
        id: 'claude-blog-short',
        title: 'Run Claude Code sessions on your own compute',
        summary: 'Claude Blog update',
      },
      {
        id: 'trusted',
        title: 'Everything we shipped at Interrupt',
        summary:
          "From autonomous debugging to one-line deploys, here's every product LangChain launched at Interrupt 2026 to help teams build, test, and ship agents in production.",
        translation: {
          title: '我们在 Interrupt 发布的全部内容',
          summary: '从自主调试到一行部署，这里汇总了 LangChain 发布的产品。',
          source: 'manual',
        },
      },
    ],
  };

  const result = await applyDigestTranslations(digest, {
    translateItem: async (item) => {
      calls.push(item.id);
      return {
        title: 'Introducing Rubrics：构建能评估并修正自身工作的智能体',
        summary: 'Deep Agents 的 RubricMiddleware 为智能体运行加入自我评估循环。',
      };
    },
  });

  assert.deepEqual(calls, ['english-long', 'claude-blog-short']);
  assert.equal(result.changedCount, 2);
  assert.deepEqual(result.digest.items[0].translation, {
    title: 'Introducing Rubrics：构建能评估并修正自身工作的智能体',
    summary: 'Deep Agents 的 RubricMiddleware 为智能体运行加入自我评估循环。',
    source: 'external-api',
  });
  assert.equal(result.digest.items[1].translation, undefined);
  assert.equal(result.digest.items[2].translation.source, 'external-api');
  assert.equal(result.digest.items[3].translation.source, 'manual');
});

test('applyDigestTranslations discards legacy local-glossary translations before deciding work', async () => {
  const digest = {
    date: '2026-06-09',
    items: [
      {
        id: 'legacy',
        title: 'Introducing Rubrics: Build Agents that Evaluate and Correct Their Work',
        summary:
          "Deep Agents' RubricMiddleware adds a self-evaluation loop to your agent runs. Set a rubric, configure a grader, and get reliable outputs on tasks where correctness matters.",
        translation: {
          title: 'Introducing Rubrics: 构建 智能体s that Evaluate and Correct Their Work',
          summary: "Deep 智能体s' RubricMiddleware adds a self-evaluation loop.",
          source: 'local-glossary',
        },
      },
    ],
  };

  const result = await applyDigestTranslations(digest, {
    translateItem: async () => ({
      title: 'Introducing Rubrics：构建能评估并修正自身工作的智能体',
      summary: 'Deep Agents 的 RubricMiddleware 为智能体运行加入自我评估循环。',
    }),
  });

  assert.equal(result.changedCount, 1);
  assert.equal(result.digest.items[0].translation.source, 'external-api');
});

test('createExternalTranslator defaults to DeepSeek V4 Flash settings', async () => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousModel = process.env.TRANSLATION_MODEL;
  const previousUrl = process.env.TRANSLATION_API_URL;
  const requests = [];

  try {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    delete process.env.TRANSLATION_MODEL;
    delete process.env.TRANSLATION_API_URL;

    const translate = createExternalTranslator({
      fetchImpl: async (url, init) => {
        requests.push({ url, body: JSON.parse(init.body), authorization: init.headers.Authorization });
        return {
          ok: true,
          async json() {
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      title: '中文标题',
                      summary: '中文摘要',
                    }),
                  },
                },
              ],
            };
          },
        };
      },
    });

    const translation = await translate({ title: 'Long English title', summary: 'Long English summary.' });

    assert.deepEqual(translation, { title: '中文标题', summary: '中文摘要' });
    assert.equal(requests[0].url, 'https://api.deepseek.com/chat/completions');
    assert.equal(requests[0].body.model, 'deepseek-v4-flash');
    assert.equal(requests[0].authorization, 'Bearer test-deepseek-key');
  } finally {
    restoreEnv('DEEPSEEK_API_KEY', previousKey);
    restoreEnv('TRANSLATION_MODEL', previousModel);
    restoreEnv('TRANSLATION_API_URL', previousUrl);
  }
});

test('hasExternalTranslatorConfig detects DeepSeek or translation API keys', () => {
  assert.equal(hasExternalTranslatorConfig({}), false);
  assert.equal(hasExternalTranslatorConfig({ DEEPSEEK_API_KEY: 'deepseek-key' }), true);
  assert.equal(hasExternalTranslatorConfig({ TRANSLATION_API_KEY: 'translation-key' }), true);
});

test('findPendingTranslationItems reports long English items without trusted translations', () => {
  const digest = {
    items: [
      {
        id: 'needs-translation',
        title: 'Introducing Rubrics: Build Agents that Evaluate and Correct Their Work',
        summary:
          "Deep Agents' RubricMiddleware adds a self-evaluation loop to your agent runs. Set a rubric, configure a grader, and get reliable outputs on tasks where correctness matters.",
        sourceName: 'LangChain Blog',
      },
      {
        id: 'mixed-cn',
        title: 'OpenAI Codex 发布 Python SDK',
        summary: 'Claude Code 新增 workflow，适合 agent 编程场景。',
      },
      {
        id: 'claude-blog-short',
        title: 'Run Claude Code sessions on your own compute',
        summary: 'Claude Blog update',
        sourceName: 'Claude Blog',
      },
      {
        id: 'trusted',
        title: 'Everything we shipped at Interrupt',
        summary:
          "From autonomous debugging to one-line deploys, here's every product LangChain launched at Interrupt 2026 to help teams build, test, and ship agents in production.",
        translation: {
          title: '我们在 Interrupt 发布的全部内容',
          summary: '从自主调试到一行部署，这里汇总了 LangChain 发布的产品。',
          source: 'external-api',
        },
      },
    ],
  };

  assert.deepEqual(findPendingTranslationItems(digest), [
    {
      id: 'needs-translation',
      sourceName: 'LangChain Blog',
      title: 'Introducing Rubrics: Build Agents that Evaluate and Correct Their Work',
    },
    {
      id: 'claude-blog-short',
      sourceName: 'Claude Blog',
      title: 'Run Claude Code sessions on your own compute',
    },
  ]);
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
