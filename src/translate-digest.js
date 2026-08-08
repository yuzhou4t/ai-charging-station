import { normalizeReadableTranslation, shouldTranslateTextBlock } from './translation.js';

const DEFAULT_TRANSLATION_SOURCE = 'external-api';
const DEFAULT_DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

export async function applyDigestTranslations(
  digest,
  { translateItem, force = false, source = DEFAULT_TRANSLATION_SOURCE } = {}
) {
  if (typeof translateItem !== 'function') {
    throw new TypeError('translateItem is required');
  }

  let changedCount = 0;
  let cleanedCount = 0;
  const items = [];

  for (const item of digest.items || []) {
    const trustedTranslation = normalizeReadableTranslation(item.translation);
    let nextItem = item;

    if (trustedTranslation) {
      nextItem = { ...item, translation: trustedTranslation };
      if (!force) {
        items.push(nextItem);
        continue;
      }
    } else if (item.translation) {
      const { translation: _translation, ...rest } = item;
      nextItem = rest;
      cleanedCount += 1;
    }

    if (!shouldTranslateTextBlock({ title: nextItem.title, summary: nextItem.summary })) {
      items.push(nextItem);
      continue;
    }

    const rawTranslation = await translateItem(nextItem);
    const translation = normalizeReadableTranslation({
      title: rawTranslation?.title,
      summary: rawTranslation?.summary,
      source: rawTranslation?.source || source,
    });

    if (!translation) {
      items.push(nextItem);
      continue;
    }

    changedCount += 1;
    items.push({ ...nextItem, translation });
  }

  return {
    digest: {
      ...digest,
      items,
    },
    changedCount,
    cleanedCount,
  };
}

export function findPendingTranslationItems(digest) {
  return (digest.items || [])
    .filter((item) => shouldTranslateTextBlock({ title: item.title, summary: item.summary }))
    .filter((item) => !normalizeReadableTranslation(item.translation))
    .map((item) => ({
      id: item.id || '',
      sourceName: item.sourceName || '',
      title: item.title || '',
    }));
}

export function createExternalTranslator({
  apiUrl = process.env.TRANSLATION_API_URL || process.env.DEEPSEEK_API_URL || DEFAULT_DEEPSEEK_API_URL,
  apiKey = process.env.TRANSLATION_API_KEY || process.env.DEEPSEEK_API_KEY,
  model = process.env.TRANSLATION_MODEL || process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) {
    throw new Error('缺少 TRANSLATION_API_KEY（也可使用 DEEPSEEK_API_KEY）');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('当前 Node 环境没有可用的 fetch');
  }

  return async function translateItem(item) {
    const response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              '你是严谨的科技新闻翻译编辑。请把英文 AI 新闻标题和摘要翻译成自然、准确的简体中文，保留必要的产品名、机构名、模型名和技术术语，不要逐词硬翻。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              instruction: '只返回 JSON：{"title":"...","summary":"..."}。不要 Markdown，不要解释。',
              title: item.title || '',
              summary: item.summary || '',
            }),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`翻译 API 请求失败：HTTP ${response.status}${body ? ` ${body.slice(0, 240)}` : ''}`);
    }

    const json = await response.json();
    return parseTranslationResponse(json.choices?.[0]?.message?.content);
  };
}

export function hasExternalTranslatorConfig(env = process.env) {
  return Boolean(env.TRANSLATION_API_KEY || env.DEEPSEEK_API_KEY);
}

export function parseTranslationResponse(value) {
  const text = stripCodeFence(String(value || '').trim());
  if (!text) {
    return null;
  }

  const parsed = JSON.parse(text);
  return {
    title: parsed.title || '',
    summary: parsed.summary || '',
  };
}

function stripCodeFence(value) {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : value;
}
