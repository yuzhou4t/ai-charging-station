import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const VALID_RATINGS = new Set(['good', 'normal', 'down', 'hide']);
const AIHOT_FEEDBACK_TAG_BOOST = 48;
const AIHOT_FEEDBACK_EXACT_GOOD_BOOST = 40;
const AIHOT_FEEDBACK_EXACT_DOWN_PENALTY = -36;
const AIHOT_FEEDBACK_TAG_DOWN_PENALTY = -36;
const AIHOT_FEEDBACK_NORMAL_PENALTY = -6;

export async function readFeedback(path) {
  try {
    return normalizeFeedback(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    return { items: [] };
  }
}

export async function recordItemFeedback(path, entry, now = new Date()) {
  const current = await readFeedback(path);
  const normalizedEntry = normalizeWritableEntry(entry, now);
  const key = feedbackEntryKey(normalizedEntry);
  const items = current.items.filter((item) => feedbackEntryKey(item) !== key);
  const next = {
    items: [...items, normalizedEntry].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function getFeedbackAdjustment(item, feedback) {
  if (!isAiHotItem(item)) {
    return { hidden: false, score: 0 };
  }

  const entries = normalizeFeedback(feedback).items;
  const exact = entries.find((entry) => feedbackEntriesMatch(item, entry));

  if (exact?.rating === 'hide') {
    return { hidden: true, score: 0 };
  }

  let score = exact?.rating === 'good' ? AIHOT_FEEDBACK_EXACT_GOOD_BOOST : 0;
  if (exact?.rating === 'down') {
    score += AIHOT_FEEDBACK_EXACT_DOWN_PENALTY;
  }
  if (exact?.rating === 'normal') {
    score += AIHOT_FEEDBACK_NORMAL_PENALTY;
  }

  const text = `${item.title || ''}\n${item.summary || ''}\n${item.category || ''}\n${item.externalSource || ''}`.toLowerCase();
  const matchedGoodTags = new Set();
  const matchedDownTags = new Set();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const normalizedTag = tag.toLowerCase();
      if (!normalizedTag || !text.includes(normalizedTag)) {
        continue;
      }

      if (entry.rating === 'hide' || entry.rating === 'down') {
        matchedDownTags.add(normalizedTag);
      } else if (entry.rating === 'good') {
        matchedGoodTags.add(normalizedTag);
      }
    }
  }

  if (matchedGoodTags.size) {
    score += Math.min(2, matchedGoodTags.size) * AIHOT_FEEDBACK_TAG_BOOST;
  }
  if (matchedDownTags.size) {
    score += Math.min(2, matchedDownTags.size) * AIHOT_FEEDBACK_TAG_DOWN_PENALTY;
  }

  return { hidden: false, score };
}

function normalizeFeedback(value) {
  const items = Array.isArray(value?.items) ? value.items : [];
  return {
    items: items
      .map((item) => normalizeReadableEntry(item))
      .filter((item) => item && feedbackEntryKey(item)),
  };
}

function normalizeReadableEntry(entry) {
  const rating = String(entry?.rating || '').trim();
  if (!VALID_RATINGS.has(rating)) {
    return null;
  }

  const normalized = {
    title: String(entry.title || '').trim(),
    url: String(entry.url || '').trim(),
    sourceId: String(entry.sourceId || '').trim(),
    sourceName: String(entry.sourceName || '').trim(),
    rating,
    tags: normalizeTags(entry.tags),
    note: String(entry.note || '').trim(),
    createdAt: entry.createdAt || null,
    updatedAt: entry.updatedAt || null,
  };

  return normalized.title || normalized.url ? normalized : null;
}

function normalizeWritableEntry(entry, now) {
  const normalized = normalizeReadableEntry({
    ...entry,
    createdAt: entry.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  });

  if (!normalized) {
    throw new Error('反馈需要提供 title/url 和有效 rating：good、normal、down 或 hide。');
  }

  return normalized;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => String(tag || '').trim()).filter(Boolean))];
}

function feedbackEntriesMatch(item, entry) {
  const itemUrl = normalizeUrl(item.url);
  const entryUrl = normalizeUrl(entry.url);
  if (itemUrl && entryUrl && itemUrl === entryUrl) {
    return true;
  }

  const itemTitle = normalizeTitle(item.title);
  const entryTitle = normalizeTitle(entry.title);
  return Boolean(itemTitle && entryTitle && itemTitle === entryTitle);
}

function feedbackEntryKey(entry) {
  const url = normalizeUrl(entry.url);
  if (url) {
    return `url:${url}`;
  }

  const title = normalizeTitle(entry.title);
  return title ? `title:${title}` : '';
}

function isAiHotItem(item) {
  return item.group === 'aihot' || item.sourceId === 'aihot';
}

function normalizeUrl(url) {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return String(url).trim().replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function normalizeTitle(title) {
  return String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
