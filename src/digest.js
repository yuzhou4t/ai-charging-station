import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { fetchSource as defaultFetchSource, parseFeedXml } from './fetchers.js';
import { readFeedback } from './feedback.js';
import { dedupeItems, rankItems } from './rank.js';
import { SOURCES } from './sources.js';
import { normalizeReadableTranslation } from './translation.js';

const TIMEZONE = 'Asia/Shanghai';
const DEFAULT_RECENT_WINDOW_HOURS = 24;
const SEEN_ITEM_LIMIT_PER_SOURCE = 5000;

export async function buildDigest({
  sources = SOURCES,
  now = new Date(),
  targetDate = null,
  recentWindowHours = DEFAULT_RECENT_WINDOW_HOURS,
  fetchSource = defaultFetchSource,
  rsshubBaseUrl = process.env.RSSHUB_BASE_URL || 'http://127.0.0.1:1200',
  sourceStatePath = null,
  manualLinksPath = null,
  feedbackPath = null,
} = {}) {
  const date = targetDate || formatDate(now);
  const generatedAt = now.toISOString();
  const dateWindow = targetDate ? beijingDateWindow(targetDate) : recentWindowHours ? rollingDateWindow(now, recentWindowHours) : null;
  const trackSeenItems = Boolean(sourceStatePath && !targetDate);
  const sourceState = sourceStatePath ? await readSourceState(sourceStatePath) : {};
  const manualLinks = manualLinksPath ? await readManualLinks(manualLinksPath) : {};
  const feedback = feedbackPath ? await readFeedback(feedbackPath) : null;
  const sourceHealth = {};
  const allItems = [];

  for (const source of sources) {
    const checkedAt = new Date().toISOString();
    const skipReason = targetDate ? null : getSourceSkipReason(source, now, sourceState[source.id]);
    if (skipReason) {
      const fallbackItems = await getFallbackItems(source, sourceState[source.id], manualLinks);
      const prepared = prepareItemsForDigest(source, fallbackItems, {
        dateWindow,
        now,
        sourceState,
        trackSeenItems,
      });
      allItems.push(...prepared.items);
      sourceHealth[source.id] = {
        ok: false,
        skipped: true,
        checkedAt,
        fallback: fallbackItems.length > 0,
        itemCount: prepared.items.length,
        fetchedCount: fallbackItems.length,
        windowedCount: prepared.windowedCount,
        seenSkippedCount: prepared.seenSkippedCount,
        bootstrap: prepared.bootstrap,
        error: skipReason,
      };
      continue;
    }

    try {
      const items = await fetchSource(source, { now, targetDate, rsshubBaseUrl });
      const normalized = items.map((item) => ({
        ...item,
        sourceId: item.sourceId || source.id,
        sourceName: item.sourceName || source.name,
        platform: item.platform || source.platform,
        group: item.group || source.group,
      }));
      const prepared = prepareItemsForDigest(source, normalized, {
        dateWindow,
        now,
        sourceState,
        trackSeenItems,
      });
      allItems.push(...prepared.items);
      sourceHealth[source.id] = {
        ok: true,
        checkedAt,
        itemCount: prepared.items.length,
        fetchedCount: normalized.length,
        windowedCount: prepared.windowedCount,
        seenSkippedCount: prepared.seenSkippedCount,
        bootstrap: prepared.bootstrap,
      };
      updateSourceState(sourceState, source, now, sourceHealth[source.id], normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallbackItems = await getFallbackItems(source, sourceState[source.id], manualLinks);
      const prepared = prepareItemsForDigest(source, fallbackItems, {
        dateWindow,
        now,
        sourceState,
        trackSeenItems,
      });
      allItems.push(...prepared.items);
      sourceHealth[source.id] = {
        ok: false,
        checkedAt,
        fallback: fallbackItems.length > 0,
        itemCount: prepared.items.length,
        fetchedCount: fallbackItems.length,
        windowedCount: prepared.windowedCount,
        seenSkippedCount: prepared.seenSkippedCount,
        bootstrap: prepared.bootstrap,
        error: source.configHint ? `${message}；${source.configHint}` : message,
      };
      updateSourceState(sourceState, source, now, sourceHealth[source.id]);
    }
  }

  if (sourceStatePath) {
    await writeSourceState(sourceStatePath, sourceState);
  }

  const items = rankItems(allItems, now, feedback).map(enrichItemTranslation);
  const sections = buildSections(items, sources, sourceHealth);
  const editorNotes = buildEditorNotes(items, sources, sourceHealth, dateWindow);

  return {
    date,
    generatedAt,
    timezone: TIMEZONE,
    windowStart: dateWindow?.start.toISOString() || null,
    windowEnd: dateWindow?.end.toISOString() || null,
    windowMode: dateWindow?.mode || null,
    windowLabel: dateWindow?.label || null,
    sourcesChecked: sources.map(({ id, name, platform, kind, group, homepage }) => ({
      id,
      name,
      platform,
      kind,
      group,
      homepage,
    })),
    sourceHealth,
    items,
    sections,
    editorNotes,
  };
}

async function readSourceState(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}

async function readManualLinks(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}

async function writeSourceState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function getFallbackItems(source, state = {}, manualLinks = {}) {
  const manualItems = normalizeManualItems(source, manualLinks[source.id] || []);
  const forgeRssItems = await readForgeRssItems(source);
  const cachedItems = normalizeCachedItems(source, state.lastSuccessfulItems || []);
  return dedupeItems([...manualItems, ...forgeRssItems, ...cachedItems]);
}

async function readForgeRssItems(source) {
  if (!source.forgeRssPath) {
    return [];
  }

  try {
    const xml = await readFile(source.forgeRssPath, 'utf8');
    return parseFeedXml(xml, source).map((item) => ({
      ...item,
      externalSource: 'ForgeRSS',
      fallback: true,
    }));
  } catch {
    return [];
  }
}

function normalizeManualItems(source, items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => normalizeFallbackItem(source, item, `manual-${index}`, '手动补链')).filter(Boolean);
}

function normalizeCachedItems(source, items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => normalizeFallbackItem(source, item, `cached-${index}`, '最近成功缓存')).filter(Boolean);
}

function normalizeFallbackItem(source, item, idSuffix, externalSource) {
  const title = String(item.title || item.url || '').trim();
  const url = String(item.url || '').trim();
  if (!title && !url) {
    return null;
  }

  return {
    id: item.id || `${source.id}-${idSuffix}`,
    sourceId: source.id,
    sourceName: source.name,
    platform: source.platform,
    group: source.group,
    title,
    url,
    summary: String(item.summary || '').trim(),
    publishedAt: item.publishedAt || null,
    targetDate: item.targetDate || null,
    category: item.category || null,
    externalSource,
    fallback: true,
  };
}

function filterItemsForWindowIfNeeded(items, dateWindow) {
  return dateWindow ? filterItemsForWindow(items, dateWindow) : items;
}

function prepareItemsForDigest(source, items, { dateWindow, now, sourceState, trackSeenItems }) {
  const windowedItems = filterItemsForWindowIfNeeded(items, dateWindow);
  let selectedItems = windowedItems;
  let seenSkippedCount = 0;
  let bootstrap = false;

  if (trackSeenItems) {
    const seenRecord = sourceState.seenItems?.[source.id];
    const seenKeys = new Set(seenRecord?.keys || []);

    if (!seenRecord && items.length) {
      selectedItems = [];
      seenSkippedCount = windowedItems.length;
      bootstrap = true;
    } else {
      selectedItems = windowedItems.filter((item) => !seenKeys.has(seenItemKey(item)));
      seenSkippedCount = windowedItems.length - selectedItems.length;
    }

    recordSeenItems(sourceState, source, items, now);
  }

  return {
    items: selectedItems,
    windowedCount: windowedItems.length,
    seenSkippedCount,
    bootstrap,
  };
}

function recordSeenItems(sourceState, source, items, now) {
  const keys = items.map(seenItemKey).filter(Boolean);
  if (!keys.length) {
    return;
  }

  const previous = sourceState.seenItems?.[source.id]?.keys || [];
  sourceState.seenItems = sourceState.seenItems || {};
  sourceState.seenItems[source.id] = {
    keys: [...new Set([...previous, ...keys])].slice(-SEEN_ITEM_LIMIT_PER_SOURCE),
    updatedAt: now.toISOString(),
  };
}

function seenItemKey(item) {
  const url = normalizeSeenUrl(item.url);
  if (url) {
    return `url:${url}`;
  }

  const title = String(item.title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return title ? `title:${title}` : '';
}

function normalizeSeenUrl(value) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    url.hash = '';
    const wechatArticleUrl = normalizeWechatArticleUrl(url);
    if (wechatArticleUrl) {
      return wechatArticleUrl;
    }
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(value).trim().replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function normalizeWechatArticleUrl(url) {
  if (!/mp\.weixin\.qq\.com$/i.test(url.hostname) || url.pathname !== '/s') {
    return '';
  }

  const identityKeys = ['__biz', 'mid', 'idx', 'sn'];
  if (!identityKeys.some((key) => url.searchParams.get(key))) {
    return '';
  }

  const normalized = new URL(`${url.origin}${url.pathname}`);
  for (const key of identityKeys) {
    const value = url.searchParams.get(key);
    if (value) {
      normalized.searchParams.set(key, value);
    }
  }
  return normalized.toString();
}

function getSourceSkipReason(source, now, state) {
  if (!source.minIntervalHours || !state?.lastAttemptAt) {
    return null;
  }

  const lastAttempt = Date.parse(state.lastAttemptAt);
  if (!Number.isFinite(lastAttempt)) {
    return null;
  }

  const minIntervalMs = source.minIntervalHours * 36e5;
  const elapsed = now.getTime() - lastAttempt;
  if (elapsed >= minIntervalMs) {
    return null;
  }

  const nextAttemptAt = formatDateTime(new Date(lastAttempt + minIntervalMs));
  return `已跳过：${source.name} 设置为 ${formatInterval(source.minIntervalHours)}内最多请求一次，以减少平台安全验证；下次可尝试时间 ${nextAttemptAt}`;
}

function formatInterval(hours) {
  if (hours < 1) {
    return `${Math.round(hours * 60)} 分钟`;
  }

  return `${hours} 小时`;
}

function updateSourceState(sourceState, source, now, health, successfulItems = null) {
  if (!source.minIntervalHours) {
    return;
  }

  const previous = sourceState[source.id] || {};
  sourceState[source.id] = {
    ...previous,
    lastAttemptAt: now.toISOString(),
    lastOk: Boolean(health.ok),
    lastItemCount: health.itemCount || 0,
    lastError: health.error || null,
  };

  if (health.ok && Array.isArray(successfulItems)) {
    sourceState[source.id].lastSuccessfulItems = successfulItems.slice(0, 30);
  }
}

export async function writeDigest(digest, outputDir = 'data', options = {}) {
  const digestsDir = join(outputDir, 'digests');
  await mkdir(digestsDir, { recursive: true });

  const jsonPath = join(digestsDir, `${digest.date}.json`);
  const markdownPath = join(digestsDir, `${digest.date}.md`);
  const latestPath = join(outputDir, 'latest.json');
  const mergedDigest = options.preserveExistingItems ? await preserveExistingDigestItems(digest, jsonPath) : digest;
  const outputDigest = prepareDigestForOutput(mergedDigest);

  await writeFile(jsonPath, `${JSON.stringify(outputDigest, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, renderMarkdown(outputDigest), 'utf8');
  await writeFile(
    latestPath,
    `${JSON.stringify(
      {
        date: outputDigest.date,
        generatedAt: outputDigest.generatedAt,
        json: `digests/${outputDigest.date}.json`,
        markdown: `digests/${outputDigest.date}.md`,
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  return { jsonPath, markdownPath, latestPath };
}

export function prepareDigestForOutput(digest) {
  const items = (digest.items || []).map(enrichItemTranslation);
  return {
    ...digest,
    items,
    sections: buildSections(items, digest.sourcesChecked || [], digest.sourceHealth || {}),
  };
}

function enrichItemTranslation(item) {
  const translation = normalizeReadableTranslation(item.translation);
  if (translation) {
    return { ...item, translation };
  }

  if (item.translation) {
    const { translation: _translation, ...rest } = item;
    return rest;
  }
  return item;
}

async function preserveExistingDigestItems(digest, jsonPath) {
  try {
    const existing = JSON.parse(await readFile(jsonPath, 'utf8'));
    if (existing.date !== digest.date || !Array.isArray(existing.items) || !existing.items.length) {
      return digest;
    }

    const mergedItems = dedupeItems([...digest.items, ...existing.items]);
    if (mergedItems.length === digest.items.length) {
      return digest;
    }

    const preservedCount = mergedItems.length - digest.items.length;
    return {
      ...digest,
      items: mergedItems,
      sections: buildSections(mergedItems, digest.sourcesChecked, digest.sourceHealth),
      editorNotes: [
        ...digest.editorNotes,
        `已保留同日已生成的 ${preservedCount} 条内容，避免手动重跑清空当天日报。`,
      ],
    };
  } catch {
    return digest;
  }
}

export function renderMarkdown(digest) {
  const lines = [
    `# AI充电站 ${digest.date}`,
    '',
    `生成时间：${digest.generatedAt}（${digest.timezone}）`,
    '',
  ];

  if (digest.windowLabel) {
    lines.push(`统计窗口：${digest.windowLabel}（${digest.windowStart} 至 ${digest.windowEnd}）`, '');
  }

  appendItems(lines, '今日必看', digest.sections.mustRead);
  appendItems(lines, '创作者更新', digest.sections.creatorUpdates);
  appendItems(lines, '官方/行业补充', digest.sections.officialUpdates);
  appendItems(lines, 'AI HOT 精选补位', digest.sections.aihotPicks);
  appendPublisherOverview(lines, digest.sections.publisherGroups || []);

  lines.push('## 源健康状态和缺失说明', '');
  for (const status of digest.sections.sourceStatus) {
    const hasFallbackNew = Boolean(status.fallback && status.itemCount);
    const hasFallbackAvailable = Boolean(status.fallbackAvailable || status.fallback);
    const mark = status.ok ? 'OK' : hasFallbackNew ? 'FALLBACK' : hasFallbackAvailable && !status.itemCount ? 'NO_NEW' : 'FAIL';
    const suffix = status.ok
      ? `${status.itemCount} 条新增`
      : hasFallbackNew
        ? `${status.itemCount} 条兜底新增；${status.error}`
        : hasFallbackAvailable && !status.itemCount
          ? `0 条新增；兜底内容已被已读基线过滤；${status.error}`
          : status.error;
    lines.push(`- ${mark} ${status.name}：${suffix}`);
  }

  if (digest.editorNotes.length) {
    lines.push('', '## 编辑说明', '');
    for (const note of digest.editorNotes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildSections(items, sources, sourceHealth) {
  const creatorUpdates = items.filter((item) => item.group === 'creator');
  const officialUpdates = items.filter((item) => item.group === 'official');
  const aihotPicks = items.filter((item) => item.group === 'aihot');

  return {
    mustRead: items.slice(0, 5),
    creatorUpdates: creatorUpdates.slice(0, 12),
    officialUpdates: officialUpdates.slice(0, 12),
    aihotPicks: aihotPicks.slice(0, 10),
    publisherGroups: buildPublisherGroups(items),
    sourceStatus: sources.map((source) => ({
      id: source.id,
      name: source.name,
      platform: source.platform,
      ok: Boolean(sourceHealth[source.id]?.ok),
      fallback: Boolean(sourceHealth[source.id]?.fallback && sourceHealth[source.id]?.itemCount),
      fallbackAvailable: Boolean(sourceHealth[source.id]?.fallback),
      itemCount: sourceHealth[source.id]?.itemCount || 0,
      fetchedCount: sourceHealth[source.id]?.fetchedCount || 0,
      windowedCount: sourceHealth[source.id]?.windowedCount || 0,
      seenSkippedCount: sourceHealth[source.id]?.seenSkippedCount || 0,
      bootstrap: Boolean(sourceHealth[source.id]?.bootstrap),
      error: sourceHealth[source.id]?.error || null,
    })),
  };
}

function buildPublisherGroups(items) {
  const groups = new Map();

  for (const item of items) {
    const publisher = publisherName(item);
    const group = groups.get(publisher) || {
      name: publisher,
      itemCount: 0,
      items: [],
    };

    group.itemCount += 1;
    if (group.items.length < 8) {
      group.items.push({
        id: item.id,
        title: item.title,
        url: item.url,
        sourceName: item.sourceName,
        category: item.category,
        summary: item.summary,
        translation: item.translation,
      });
    }
    groups.set(publisher, group);
  }

  return [...groups.values()].sort((a, b) => {
    if (b.itemCount !== a.itemCount) {
      return b.itemCount - a.itemCount;
    }
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

function publisherName(item) {
  return item.externalSource || item.sourceName || '未知发布者';
}

function buildEditorNotes(items, sources, sourceHealth, dateWindow = null) {
  const notes = [];
  const failed = sources.filter((source) => !sourceHealth[source.id]?.ok);

  if (!items.length) {
    const checkedItemsCount = sources.reduce((sum, source) => sum + (sourceHealth[source.id]?.fetchedCount || 0), 0);
    if (checkedItemsCount && dateWindow) {
      notes.push(`${dateWindow.label}没有发现新增内容；源已检查，这不代表抓取失败。`);
    } else {
      notes.push('没有抓到可用条目，请优先检查 RSSHub 是否启动，以及平台 Cookie/额度是否有效。');
    }
  }

  const bootstrapped = sources.filter((source) => sourceHealth[source.id]?.bootstrap);
  if (bootstrapped.length) {
    notes.push(`已为 ${bootstrapped.map((source) => source.name).join('、')} 建立已读基线，本次不推历史内容；之后只推新增。`);
  }

  if (dateWindow && sources.some((source) => (sourceHealth[source.id]?.fetchedCount || 0) > (sourceHealth[source.id]?.itemCount || 0))) {
    notes.push(`已按${dateWindow.label}和已读基线过滤历史条目，避免旧内容混入每日推送。`);
  }

  for (const source of failed) {
    const health = sourceHealth[source.id];
    const fallbackText = health.fallback
      ? health.itemCount
        ? `；已使用 ${health.itemCount} 条兜底新增。`
        : '；兜底内容已在已读基线中，未重复推送。'
      : '';
    notes.push(`${source.name} 抓取失败：${health.error}${fallbackText}`);
  }

  const rsshubFailures = failed.filter((source) => source.kind === 'rsshub');
  if (rsshubFailures.length) {
    notes.push('RSSHub 类源失败不会阻断日报；启动本地 RSSHub 后可重新运行 npm run digest。');
  }

  return notes;
}

function appendItems(lines, title, items) {
  lines.push(`## ${title}`, '');

  if (!items.length) {
    lines.push('暂无。', '');
    return;
  }

  for (const item of items) {
    const source = item.externalSource ? `${item.sourceName}/${item.externalSource}` : item.sourceName;
    const titleText = displayTitle(item);
    const link = item.url ? `[${titleText}](${item.url})` : titleText;
    lines.push(`- ${link}（${source}）`);
    const summaryText = displaySummary(item);
    if (summaryText) {
      lines.push(`  ${summaryText}`);
    }
  }

  lines.push('');
}

function displayTitle(item) {
  const translation = normalizeReadableTranslation(item.translation);
  return cleanComparableText(translation?.title) || cleanComparableText(item.title);
}

function displaySummary(item) {
  const translation = normalizeReadableTranslation(item.translation);
  return cleanComparableText(translation?.summary) || cleanComparableText(item.summary);
}

function cleanComparableText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function appendPublisherOverview(lines, publisherGroups) {
  lines.push('## 发布者概览', '');

  if (!publisherGroups.length) {
    lines.push('暂无。', '');
    return;
  }

  for (const group of publisherGroups) {
    lines.push(`- ${group.name}：${group.itemCount} 条`);
    for (const item of group.items.slice(0, 5)) {
      const category = item.category ? ` [${item.category}]` : '';
      lines.push(`  -${category} ${displayTitle(item)}`);
    }
    if (group.itemCount > 5) {
      lines.push(`  - 还有 ${group.itemCount - 5} 条，详见 JSON。`);
    }
  }

  lines.push('');
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function beijingDateWindow(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid DIGEST_DATE: ${date}. Expected YYYY-MM-DD.`);
  }

  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 36e5);
  return { date, start, end, mode: 'beijing-date', label: `${date} 北京时间当天`, includeUndated: false };
}

function rollingDateWindow(now, hours) {
  const end = now;
  const start = new Date(end.getTime() - hours * 36e5);
  return { start, end, mode: 'rolling', label: `过去 ${formatInterval(hours)}`, includeUndated: true };
}

function filterItemsForWindow(items, dateWindow) {
  return items.filter((item) => {
    if (dateWindow.date && item.targetDate === dateWindow.date) {
      return true;
    }

    if (!item.publishedAt) {
      return Boolean(dateWindow.includeUndated);
    }

    const timestamp = Date.parse(item.publishedAt);
    if (!Number.isFinite(timestamp)) {
      return Boolean(dateWindow.includeUndated);
    }

    return timestamp >= dateWindow.start.getTime() && timestamp < dateWindow.end.getTime();
  });
}
