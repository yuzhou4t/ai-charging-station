import { createHash } from 'node:crypto';

import { dedupeItems } from './rank.js';
import { normalizeReadableTranslation } from './translation.js';

export const AIHOT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 aihot-skill/0.2.0';

const DEFAULT_TIMEOUT_MS = 20_000;

export async function fetchSource(source, options = {}) {
  switch (source.kind) {
    case 'rsshub':
      return fetchRssHubSource(source, options);
    case 'rss':
      return fetchRssSource(source, source.url, options);
    case 'claude-blog':
      return fetchClaudeBlogSource(source, options);
    case 'html-list':
      return fetchHtmlListSource(source, options);
    case 'aihot':
      return fetchAiHotSource(source, options);
    default:
      throw new Error(`Unsupported source kind: ${source.kind}`);
  }
}

export async function fetchRssHubSource(source, options = {}) {
  const baseUrl = options.rsshubBaseUrl || process.env.RSSHUB_BASE_URL || 'http://127.0.0.1:1200';
  const urls = [
    readSourceUrlEnv(source),
    ...[source.path, ...(source.fallbackPaths || [])].filter(Boolean).map((path) => new URL(path, ensureTrailingSlash(baseUrl)).toString()),
  ].filter(Boolean);
  const failures = [];

  for (const url of urls) {
    try {
      return await fetchRssSource(source, url, options);
    } catch (error) {
      failures.push(formatRequestFailure(url, error));
    }
  }

  throw new Error(`RSSHub routes failed: ${failures.join('; ')}`);
}

function readSourceUrlEnv(source) {
  if (!source.urlEnv) {
    return '';
  }

  return String(process.env[source.urlEnv] || '').trim();
}

export async function fetchRssSource(source, url, options = {}) {
  const requestInit = source.timeoutMs || options.timeoutMs ? { timeoutMs: source.timeoutMs || options.timeoutMs } : {};
  const xml = await (options.fetchText || fetchText)(url, requestInit);
  return parseFeedXml(xml, source);
}

export async function fetchClaudeBlogSource(source, options = {}) {
  const html = await (options.fetchText || fetchText)(source.url);
  return parseClaudeBlogHtml(html, source);
}

export async function fetchHtmlListSource(source, options = {}) {
  const html = await (options.fetchText || fetchText)(source.url);
  return parseHtmlList(html, source);
}

export async function fetchAiHotSource(source, options = {}) {
  if (source.sourceIncludes?.length) {
    return fetchAiHotFilteredSource(source, options);
  }

  if (options.targetDate) {
    return fetchAiHotDailySource(source, options);
  }

  const fetchJsonImpl = options.fetchJson || fetchJson;
  const baseUrl = source.url || 'https://aihot.virxact.com/api/public/items';
  const now = options.now || new Date();
  const since = new Date(now.getTime() - 24 * 36e5).toISOString();
  const urls = [buildAiHotUrl(baseUrl, { mode: 'selected', since, take: '50' })];

  for (const keyword of source.keywords || []) {
    urls.push(buildAiHotUrl(baseUrl, { q: keyword, take: '20' }));
  }

  const batches = [];
  const failures = [];
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const json = await fetchJsonWithRetry(fetchJsonImpl, url, {
          headers: {
            'User-Agent': AIHOT_USER_AGENT,
            Accept: 'application/json',
          },
        });
        return { ok: true, items: mapAiHotItems(json.items || [], source) };
      } catch (error) {
        return { ok: false, failure: formatRequestFailure(url, error) };
      }
    })
  );

  let successCount = 0;
  for (const result of results) {
    if (result.ok) {
      successCount += 1;
      batches.push(...result.items);
    } else {
      failures.push(result.failure);
    }
  }

  if (!successCount) {
    throw new Error(`AI HOT requests failed: ${failures.join('; ')}`);
  }

  return dedupeItems(batches);
}

export async function fetchAiHotFilteredSource(source, options = {}) {
  const fetchJsonImpl = options.fetchJson || fetchJson;
  const baseUrl = source.url || 'https://aihot.virxact.com/api/public/items';
  const window = aiHotItemsWindow(source, options);
  const mode = source.mode || 'all';
  const take = String(source.pageSize || 100);
  const maxPages = source.maxPages || 10;
  const batches = [];
  const failures = [];
  let successCount = 0;
  let cursor = '';

  for (let page = 0; page < maxPages; page += 1) {
    const params = { mode, since: window.start.toISOString(), take };
    if (cursor) {
      params.cursor = cursor;
    }

    const url = buildAiHotUrl(baseUrl, params);
    try {
      const json = await fetchJsonWithRetry(fetchJsonImpl, url, {
        headers: {
          'User-Agent': AIHOT_USER_AGENT,
          Accept: 'application/json',
        },
      });
      successCount += 1;
      const pageItems = json.items || [];
      batches.push(...mapAiHotItems(pageItems.filter((item) => matchesAiHotSource(item, source)), source));

      cursor = json.nextCursor || '';
      if (!cursor || !pageItems.length) {
        break;
      }
    } catch (error) {
      failures.push(formatRequestFailure(url, error));
      break;
    }
  }

  if (!successCount) {
    throw new Error(`AI HOT source-filter requests failed: ${failures.join('; ')}`);
  }

  return dedupeItems(batches);
}

export async function fetchAiHotDailySource(source, options = {}) {
  const fetchJsonImpl = options.fetchJson || fetchJson;
  const url = buildAiHotDailyUrl(source.url || 'https://aihot.virxact.com/api/public/items', options.targetDate);
  const json = await fetchJsonWithRetry(fetchJsonImpl, url, {
    headers: {
      'User-Agent': AIHOT_USER_AGENT,
      Accept: 'application/json',
    },
  });

  const items = [];
  for (const section of json.sections || []) {
    for (const item of section.items || []) {
      items.push(
        normalizeItem(
          {
            title: item.title,
            url: item.sourceUrl || item.url,
            summary: item.summary || '',
            publishedAt: new Date(`${options.targetDate}T08:00:00+08:00`).toISOString(),
            targetDate: options.targetDate,
            category: section.label,
            externalSource: item.sourceName || item.source,
          },
          source
        )
      );
    }
  }

  return dedupeItems(items);
}

async function fetchJsonWithRetry(fetchJsonImpl, url, init, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJsonImpl(url, init);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(500 * attempt);
      }
    }
  }

  throw lastError;
}

function formatRequestFailure(url, error) {
  const message = error instanceof Error ? error.message : String(error);
  return `${url}: ${message}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aiHotItemsWindow(source, options = {}) {
  if (options.targetDate) {
    const start = new Date(`${options.targetDate}T00:00:00+08:00`);
    return { start, end: new Date(start.getTime() + 24 * 36e5) };
  }

  const now = options.now || new Date();
  const hours = source.recentWindowHours || 24;
  return { start: new Date(now.getTime() - hours * 36e5), end: now };
}

function matchesAiHotSource(item, source) {
  const sourceText = String(item.source || item.sourceName || '');
  return (source.sourceIncludes || []).some((keyword) => sourceText.toLowerCase().includes(String(keyword).toLowerCase()));
}

export function parseFeedXml(xml, source) {
  const blocks = matchBlocks(xml, 'item');
  const atomBlocks = blocks.length ? [] : matchBlocks(xml, 'entry');
  const entries = blocks.length ? blocks : atomBlocks;

  return entries
    .map((block) => {
      const title = cleanText(readTag(block, 'title'));
      const url = cleanText(readTag(block, 'link')) || readAtomHref(block);
      const summary = cleanText(readTag(block, 'description') || readTag(block, 'summary') || readTag(block, 'content'));
      const publishedRaw = cleanText(readTag(block, 'pubDate') || readTag(block, 'published') || readTag(block, 'updated'));
      const publishedAt = normalizeDate(publishedRaw);
      const externalSource = cleanText(readFeedAuthor(block));

      if (!title && !url) {
        return null;
      }

      return normalizeItem(
        {
          title: title || url,
          url,
          summary,
          publishedAt,
          externalSource,
        },
        source
      );
    })
    .filter(Boolean);
}

export function parseClaudeBlogHtml(html, source) {
  const anchors = parseAnchors(html);
  const items = [];

  for (const anchor of anchors) {
    const url = absoluteUrl(anchor.href, 'https://claude.com');
    if (!url || !new URL(url).pathname.startsWith('/blog/') || new URL(url).pathname === '/blog') {
      continue;
    }

    const title = anchor.text || titleFromSlug(url);
    items.push(
      normalizeItem(
        {
          title,
          url,
          summary: 'Claude Blog update',
        },
        source
      )
    );
  }

  return dedupeItems(items).slice(0, 30);
}

export function parseHtmlList(html, source) {
  const items = parseJsonLdItems(html, source);
  if (items.length) {
    return items;
  }

  return parseAnchors(html)
    .map((anchor) => {
      const url = absoluteUrl(anchor.href, source.url);
      if (!url || !url.startsWith(source.url)) {
        return null;
      }
      return normalizeItem({ title: anchor.text || titleFromSlug(url), url }, source);
    })
    .filter(Boolean);
}

function parseJsonLdItems(html, source) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const items = [];

  for (const script of scripts) {
    try {
      const json = JSON.parse(decodeEntities(script[1]).trim());
      const nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
      for (const node of nodes) {
        const list = node.itemListElement || [];
        for (const entry of list) {
          if (entry.url || entry.name) {
            items.push(
              normalizeItem(
                {
                  title: entry.name,
                  url: absoluteUrl(entry.url, source.url),
                  summary: node.description || '',
                },
                source
              )
            );
          }
        }
      }
    } catch {
      continue;
    }
  }

  return dedupeItems(items);
}

function mapAiHotItems(items, source) {
  return items
    .map((item) => {
      const titleZh = item.titleZh || item.cnTitle || '';
      const summaryZh = item.summaryZh || item.cnSummary || '';
      const titleOriginal = item.title || '';
      const summaryOriginal = item.summary || '';

      return normalizeItem(
        {
          title: titleZh || titleOriginal,
          url: item.url,
          summary: summaryZh || summaryOriginal || '',
          publishedAt: normalizeDate(item.publishedAt),
          category: item.category,
          externalSource: item.source,
          originalTitle: titleZh && titleOriginal && titleOriginal !== titleZh ? titleOriginal : '',
          originalSummary: summaryZh && summaryOriginal && summaryOriginal !== summaryZh ? summaryOriginal : '',
          translation: titleZh || summaryZh ? { title: titleZh, summary: summaryZh, source: 'aihot' } : null,
        },
        source
      );
    })
    .filter((item) => item.title || item.url);
}

function normalizeItem(item, source) {
  const title = cleanText(item.title);
  const url = item.url || '';
  const summary = cleanText(item.summary);
  const originalTitle = cleanText(item.originalTitle);
  const originalSummary = cleanText(item.originalSummary);
  const translation = normalizeReadableTranslation(item.translation);

  const normalized = {
    id: item.id || stableId(source.id, url || title),
    sourceId: source.id,
    sourceName: source.name,
    platform: source.platform,
    group: source.group,
    title,
    url,
    summary,
    publishedAt: item.publishedAt || null,
    targetDate: item.targetDate || null,
    category: item.category || null,
    externalSource: item.externalSource || null,
  };

  if (originalTitle) {
    normalized.originalTitle = originalTitle;
  }
  if (originalSummary) {
    normalized.originalSummary = originalSummary;
  }
  if (translation?.title || translation?.summary) {
    normalized.translation = translation;
  }

  return normalized;
}

async function fetchText(url, init = {}) {
  const response = await request(url, {
    ...init,
    headers: {
      'User-Agent': AIHOT_USER_AGENT,
      Accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

async function fetchJson(url, init = {}) {
  const response = await request(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function request(url, init = {}) {
  try {
    return await fetchWithTimeout(url, init);
  } catch (error) {
    const reason = error?.cause?.code || error?.cause?.message || error?.message || String(error);
    throw new Error(`Request failed for ${url}: ${reason}`, { cause: error });
  }
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildAiHotUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function buildAiHotDailyUrl(baseUrl, targetDate) {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/\/items$/, `/daily/${targetDate}`);
  url.search = '';
  return url.toString();
}

function matchBlocks(xml, tagName) {
  return [...xml.matchAll(new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'gi'))].map((match) => match[0]);
}

function readTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? match[1] : '';
}

function readAtomHref(block) {
  const match = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return match ? decodeEntities(match[1]) : '';
}

function readFeedAuthor(block) {
  const raw = readTag(block, 'author') || readTag(block, 'dc:creator');
  const match = raw.match(/^[^()]*\(([\s\S]+)\)\s*$/);
  return match ? match[1] : raw;
}

function parseAnchors(html) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: decodeEntities(match[1]),
    text: cleanText(match[2]),
  }));
}

function absoluteUrl(href, base) {
  if (!href) {
    return '';
  }
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

function titleFromSlug(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const slug = parts.at(-1) || url;
    return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return url;
  }
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function cleanText(value) {
  return decodeEntities(stripTags(String(value || '')))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function stableId(sourceId, value) {
  const digest = createHash('sha1').update(`${sourceId}:${value}`).digest('hex').slice(0, 12);
  return `${sourceId}-${digest}`;
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}
