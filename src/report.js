import { normalizeReadableTranslation } from './translation.js';

const DEFAULT_LIMITS = {
  mustRead: 5,
  creatorUpdates: 6,
  officialUpdates: 5,
  aihotPicks: 5,
};

const SECTION_TITLES = {
  mustRead: '今日必看',
  creatorUpdates: '创作者更新',
  officialUpdates: '官方/行业补充',
  aihotPicks: 'AI HOT 精选补位',
};

export function formatDigestReport(digest, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const healthValues = Object.values(digest.sourceHealth || {});
  const okCount = healthValues.filter((status) => status.ok).length;
  const fallbackCount = healthValues.filter((status) => status.fallback).length;
  const failedCount = healthValues.length - okCount;
  const lines = [
    `AI充电站 ${digest.date} 内容摘要`,
    `总条目：${digest.items?.length || 0}；源状态：${okCount}/${healthValues.length} OK，${fallbackCount} 个兜底，${failedCount} 个失败或跳过。`,
    '',
  ];
  if (digest.windowLabel) {
    lines.splice(2, 0, `统计窗口：${digest.windowLabel}。`);
  }
  const seenItems = new Set();

  appendPublisherGroups(lines, digest.sections?.publisherGroups || []);
  appendReportSection(lines, SECTION_TITLES.mustRead, digest.sections?.mustRead || [], limits.mustRead, seenItems);
  appendReportSection(lines, SECTION_TITLES.creatorUpdates, digest.sections?.creatorUpdates || [], limits.creatorUpdates, seenItems);
  appendReportSection(lines, SECTION_TITLES.officialUpdates, digest.sections?.officialUpdates || [], limits.officialUpdates, seenItems);
  appendReportSection(lines, SECTION_TITLES.aihotPicks, digest.sections?.aihotPicks || [], limits.aihotPicks, seenItems);
  appendSourceIssues(lines, digest.sections?.sourceStatus || []);

  return lines.join('\n');
}

function appendReportSection(lines, title, items, limit, seenItems) {
  lines.push(`## ${title}`);
  const visibleItems = [];

  for (const item of items) {
    const key = itemKey(item);
    if (key && seenItems.has(key)) {
      continue;
    }
    visibleItems.push(item);
  }

  if (!visibleItems.length) {
    lines.push('暂无。', '');
    return;
  }

  for (const item of visibleItems.slice(0, limit)) {
    const key = itemKey(item);
    if (key) {
      seenItems.add(key);
    }
    const source = item.externalSource ? `${item.sourceName}/${item.externalSource}` : item.sourceName;
    lines.push(`- ${displayTitle(item)}（${source || '未知来源'}）`);
    lines.push(`  讲了：${cleanSummary(displaySummary(item))}`);
    if (item.url) {
      lines.push(`  链接：${item.url}`);
    }
  }

  if (visibleItems.length > limit) {
    lines.push(`- 还有 ${visibleItems.length - limit} 条，详见 Markdown/JSON。`);
  }
  lines.push('');
}

function appendPublisherGroups(lines, publisherGroups) {
  lines.push('## 发布者概览');
  if (!publisherGroups.length) {
    lines.push('暂无。', '');
    return;
  }

  for (const group of publisherGroups.slice(0, 8)) {
    lines.push(`- ${group.name}：${group.itemCount} 条`);
    for (const item of (group.items || []).slice(0, 4)) {
      const category = item.category ? ` [${item.category}]` : '';
      lines.push(`  -${category} ${displayTitle(item)}`);
    }
  }
  if (publisherGroups.length > 8) {
    lines.push(`- 还有 ${publisherGroups.length - 8} 个发布者，详见 Markdown/JSON。`);
  }
  lines.push('');
}

function itemKey(item) {
  return item.url || String(item.title || '').trim().toLowerCase();
}

function appendSourceIssues(lines, sourceStatus) {
  const issues = sourceStatus.filter((status) => !status.ok);
  if (!issues.length) {
    return;
  }

  lines.push('## 源状态提醒');
  for (const status of issues) {
    const hasFallbackNew = Boolean(status.fallback && status.itemCount);
    const hasFallbackAvailable = Boolean(status.fallbackAvailable || status.fallback);
    const mark = hasFallbackNew ? 'FALLBACK' : hasFallbackAvailable && !status.itemCount ? 'NO_NEW' : 'FAIL';
    const fallbackText = hasFallbackNew
      ? `，已用 ${status.itemCount} 条兜底新增`
      : hasFallbackAvailable && !status.itemCount
        ? '，兜底内容已被基线过滤'
        : '';
    lines.push(`- ${mark} ${status.name}${fallbackText}：${truncate(status.error || '未返回错误说明', 140)}`);
  }
  lines.push('');
}

function cleanSummary(value) {
  const text = String(value || '')
    .replace(/View Original(?: Note)?/gi, ' ')
    .replace(/Watch on Xiaohongshu/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return truncate(text || '摘要缺失，建议点开原文看。', 180);
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

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
