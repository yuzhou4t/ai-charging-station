import { getFeedbackAdjustment } from './feedback.js';

const INTEREST_TERMS = [
  'codex',
  'claude code',
  'agent',
  'agents',
  'ai coding',
  'skill',
  'skills',
  'mcp',
  'rag',
  'workflow',
  'langchain',
  'openai',
  'anthropic',
  'gpt',
  '模型',
  '知识库',
  '智能体',
  '自动化',
  '提示词',
  '上下文',
  '编程',
  '产品',
];

const GROUP_BASE_SCORE = {
  creator: 80,
  official: 60,
  aihot: 50,
};

export function rankItems(items, now = new Date(), feedback = null) {
  const scored = [];

  for (const [index, item] of items.entries()) {
    const feedbackAdjustment = getFeedbackAdjustment(item, feedback);
    if (feedbackAdjustment.hidden) {
      continue;
    }

    scored.push({
      ...item,
      score: (Number.isFinite(item.score) ? item.score : scoreItem(item, now)) + feedbackAdjustment.score,
      _index: index,
    });
  }

  return dedupeItems(scored)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const dateA = Date.parse(a.publishedAt || '') || 0;
      const dateB = Date.parse(b.publishedAt || '') || 0;
      if (dateB !== dateA) {
        return dateB - dateA;
      }

      return a._index - b._index;
    })
    .map(({ _index, ...item }) => item);
}

export function dedupeItems(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const result = [];

  for (const item of items) {
    const urlKey = normalizeUrl(item.url);
    const titleKey = normalizeTitle(item.title);

    if ((urlKey && seenUrls.has(urlKey)) || (titleKey && seenTitles.has(titleKey))) {
      continue;
    }

    if (urlKey) {
      seenUrls.add(urlKey);
    }
    if (titleKey) {
      seenTitles.add(titleKey);
    }

    result.push(item);
  }

  return result;
}

export function scoreItem(item, now = new Date()) {
  const text = `${item.title || ''}\n${item.summary || ''}`.toLowerCase();
  let score = GROUP_BASE_SCORE[item.group] || 40;

  for (const term of INTEREST_TERMS) {
    if (text.includes(term.toLowerCase())) {
      score += 8;
    }
  }

  const published = Date.parse(item.publishedAt || '');
  if (Number.isFinite(published)) {
    const ageHours = Math.max(0, (now.getTime() - published) / 36e5);
    if (ageHours <= 24) {
      score += 12;
    } else if (ageHours <= 72) {
      score += 6;
    }
  }

  return score;
}

function normalizeUrl(url) {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const wechatArticleUrl = normalizeWechatArticleUrl(parsed);
    if (wechatArticleUrl) {
      return wechatArticleUrl;
    }
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return String(url).trim().replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function normalizeWechatArticleUrl(parsed) {
  if (!/mp\.weixin\.qq\.com$/i.test(parsed.hostname) || parsed.pathname !== '/s') {
    return '';
  }

  const identityKeys = ['__biz', 'mid', 'idx', 'sn'];
  if (!identityKeys.some((key) => parsed.searchParams.get(key))) {
    return '';
  }

  const normalized = new URL(`${parsed.origin}${parsed.pathname}`);
  for (const key of identityKeys) {
    const value = parsed.searchParams.get(key);
    if (value) {
      normalized.searchParams.set(key, value);
    }
  }
  return normalized.toString();
}

function normalizeTitle(title) {
  return String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
