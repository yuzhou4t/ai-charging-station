import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const DEFAULT_RETENTION_DAYS = 30;

export async function mergeAiHotFlowStore({
  storePath,
  incomingItems,
  feedbackPath,
  digestDir,
  now = new Date(),
  retentionDays = DEFAULT_RETENTION_DAYS,
}) {
  const store = await readFlowStore(storePath);
  const feedback = await readFlowFeedback(feedbackPath);
  const protectedKeys = await readProtectedKeys({ feedback, digestDir });
  const existingByKey = new Map(store.items.map((item) => [flowItemKey(item), item]).filter(([key]) => key));
  let added = 0;
  let updated = 0;

  for (const item of incomingItems || []) {
    const normalized = normalizeFlowItem(item, now);
    const key = flowItemKey(normalized);
    if (!key) continue;

    const existing = existingByKey.get(key);
    if (existing) {
      existingByKey.set(key, {
        ...existing,
        ...normalized,
        firstSeenAt: existing.firstSeenAt || normalized.firstSeenAt,
        lastSeenAt: now.toISOString(),
      });
      updated += 1;
    } else {
      existingByKey.set(key, normalized);
      added += 1;
    }
  }

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 36e5);
  let pruned = 0;
  let protectedCount = 0;
  const items = [];

  for (const item of existingByKey.values()) {
    const key = flowItemKey(item);
    const reasons = protectedKeys.get(key) || [];
    const protectedItem = reasons.length > 0;
    if (protectedItem) {
      protectedCount += 1;
    }

    const retentionDate = new Date(item.publishedAt || item.lastSeenAt || item.firstSeenAt || now);
    if (!protectedItem && retentionDate < cutoff) {
      pruned += 1;
      continue;
    }

    items.push({
      ...item,
      protectedReasons: reasons,
    });
  }

  items.sort((a, b) => Date.parse(b.publishedAt || b.lastSeenAt || 0) - Date.parse(a.publishedAt || a.lastSeenAt || 0));
  const nextStore = {
    updatedAt: now.toISOString(),
    retentionDays,
    items,
    stats: {
      incoming: incomingItems?.length || 0,
      stored: items.length,
      added,
      updated,
      pruned,
      protected: protectedCount,
      cutoff: cutoff.toISOString(),
    },
  };

  await writeJson(storePath, nextStore);
  return nextStore;
}

export async function readFlowStore(path) {
  const value = await readJson(path, { updatedAt: null, retentionDays: DEFAULT_RETENTION_DAYS, items: [], stats: {} });
  return {
    updatedAt: value.updatedAt || null,
    retentionDays: Number(value.retentionDays) || DEFAULT_RETENTION_DAYS,
    items: Array.isArray(value.items) ? value.items.map((item) => normalizeFlowItem(item)).filter((item) => flowItemKey(item)) : [],
    stats: value.stats || {},
  };
}

export async function readFlowFeedback(path) {
  const value = await readJson(path, { items: [] });
  return {
    items: Array.isArray(value.items) ? value.items.map(normalizeFeedbackItem).filter((item) => feedbackItemKey(item)) : [],
  };
}

export async function recordFlowFeedback(path, entry, now = new Date()) {
  const feedback = await readFlowFeedback(path);
  const normalized = normalizeFeedbackItem({
    ...entry,
    createdAt: entry.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  });
  const key = feedbackItemKey(normalized);
  if (!key) {
    throw new Error('AI HOT 流反馈需要提供 item/url/title。');
  }

  const items = feedback.items.filter((item) => feedbackItemKey(item) !== key);
  const next = {
    items: [...items, normalized].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
  };
  await writeJson(path, next);
  return next;
}

async function readProtectedKeys({ feedback, digestDir }) {
  const protectedKeys = new Map();

  for (const item of feedback.items || []) {
    if (item.saved) addProtectedKey(protectedKeys, item, 'saved');
    if (item.liked) addProtectedKey(protectedKeys, item, 'liked');
  }

  for (const item of await readDigestItems(digestDir)) {
    addProtectedKey(protectedKeys, item, 'daily');
  }

  return protectedKeys;
}

async function readDigestItems(digestDir) {
  if (!digestDir) return [];

  try {
    const files = await readdir(digestDir);
    const items = [];
    for (const file of files.filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
      try {
        const digest = JSON.parse(await readFile(join(digestDir, file), 'utf8'));
        if (Array.isArray(digest.items)) {
          items.push(...digest.items);
        }
      } catch {
        continue;
      }
    }
    return items;
  } catch {
    return [];
  }
}

function addProtectedKey(map, item, reason) {
  const key = flowItemKey(item);
  if (!key) return;
  const reasons = new Set(map.get(key) || []);
  reasons.add(reason);
  map.set(key, [...reasons]);
}

function normalizeFlowItem(item, now = new Date()) {
  const firstSeenAt = item.firstSeenAt || now.toISOString();
  const lastSeenAt = item.lastSeenAt || now.toISOString();
  return {
    id: String(item.id || item.url || item.title || '').trim(),
    sourceId: String(item.sourceId || 'aihot-api').trim(),
    sourceName: String(item.sourceName || 'AI HOT').trim(),
    platform: String(item.platform || 'aihot').trim(),
    group: String(item.group || 'aihot').trim(),
    title: String(item.title || item.url || '').trim(),
    url: String(item.url || '').trim(),
    summary: String(item.summary || '').trim(),
    publishedAt: item.publishedAt || null,
    category: item.category || null,
    externalSource: item.externalSource || null,
    score: Number(item.score) || null,
    selected: Boolean(item.selected),
    firstSeenAt,
    lastSeenAt,
  };
}

function normalizeFeedbackItem(entry) {
  const item = entry.item || entry;
  const base = normalizeFlowItem(item, new Date(entry.createdAt || Date.now()));
  return {
    itemId: base.id,
    title: base.title,
    url: base.url,
    source: base.externalSource || base.sourceName,
    liked: Boolean(entry.liked),
    saved: Boolean(entry.saved),
    muted: Boolean(entry.muted),
    createdAt: entry.createdAt || null,
    updatedAt: entry.updatedAt || null,
  };
}

function flowItemKey(item) {
  const url = normalizeUrl(item.url);
  if (url) return `url:${url}`;
  const id = String(item.id || '').trim();
  if (id) return `id:${id}`;
  const title = normalizeTitle(item.title);
  return title ? `title:${title}` : '';
}

function feedbackItemKey(item) {
  return flowItemKey({ url: item.url, id: item.itemId, title: item.title });
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return String(url).trim().replace(/#.*$/, '').replace(/\/$/, '');
  }
}

function normalizeTitle(title) {
  return String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
