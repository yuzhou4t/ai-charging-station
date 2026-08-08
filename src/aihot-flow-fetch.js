import { SOURCES } from './sources.js';
import { AIHOT_USER_AGENT, fetchSource } from './fetchers.js';

const AIHOT_ITEMS_URL = 'https://aihot.virxact.com/api/public/items';

export async function fetchAiHotFlowItems({ now = new Date(), includeHourlySources = true } = {}) {
  const sourceHealth = {};
  const aiHotItems = await fetchAiHotApiItems({ now });
  sourceHealth['aihot-api'] = {
    ok: true,
    count: aiHotItems.length,
    checkedAt: now.toISOString(),
  };

  const hourlyItems = includeHourlySources ? await fetchHourlySourceItems({ now, sourceHealth }) : [];
  return {
    items: dedupeFlowItems([...aiHotItems, ...hourlyItems]),
    sourceHealth,
  };
}

export async function fetchAiHotApiItems({ now = new Date(), maxItems = 5000 } = {}) {
  const items = [];
  let cursor = '';
  const since = new Date(now.getTime() - 7 * 24 * 36e5).toISOString();

  while (items.length < maxItems) {
    const url = new URL(AIHOT_ITEMS_URL);
    url.searchParams.set('mode', 'all');
    url.searchParams.set('since', since);
    url.searchParams.set('take', '100');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': AIHOT_USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url.toString()}`);
    }

    const payload = await response.json();
    items.push(...(payload.items || []).map(normalizeAiHotItem));
    cursor = payload.nextCursor || '';
    if (!cursor || !payload.items?.length) {
      break;
    }
  }

  return dedupeFlowItems(items);
}

export function hourlyFlowSources() {
  return SOURCES.filter((source) => source.platform === 'bilibili');
}

async function fetchHourlySourceItems({ now, sourceHealth }) {
  const items = [];

  for (const source of hourlyFlowSources()) {
    try {
      const sourceItems = await fetchSource(source);
      const normalized = sourceItems.map((item) => ({
        ...item,
        sourceId: item.sourceId || source.id,
        sourceName: item.sourceName || source.name,
        platform: item.platform || source.platform,
        group: item.group || source.group,
        category: item.category || source.platform,
        externalSource: item.externalSource || source.name,
      }));
      items.push(...normalized);
      sourceHealth[source.id] = {
        ok: true,
        count: normalized.length,
        checkedAt: now.toISOString(),
      };
    } catch (error) {
      sourceHealth[source.id] = {
        ok: false,
        count: 0,
        checkedAt: now.toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return items;
}

function normalizeAiHotItem(item) {
  const titleZh = item.titleZh || item.cnTitle || '';
  const summaryZh = item.summaryZh || item.cnSummary || '';

  return {
    id: item.id || item.url || item.title || titleZh,
    sourceId: 'aihot-api',
    sourceName: 'AI HOT',
    platform: 'aihot',
    group: 'aihot',
    title: titleZh || item.title || item.url,
    url: item.url,
    summary: summaryZh || item.summary || '',
    publishedAt: item.publishedAt || null,
    category: item.category || null,
    externalSource: item.source || item.sourceName || null,
    score: item.score || null,
    selected: Boolean(item.selected || item.aiSelected),
  };
}

function dedupeFlowItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.url || item.id || item.title;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
