const PUBLIC_SECTION_KEYS = ['mustRead', 'creatorUpdates', 'officialUpdates', 'aihotPicks'];

export function buildPublicDaily(digest) {
  if (!digest || typeof digest !== 'object' || !digest.date) {
    throw new Error('日报缺少 date，无法生成公开快照。');
  }

  const sections = Object.fromEntries(
    PUBLIC_SECTION_KEYS.map((key) => [key, sanitizeItems(digest.sections?.[key])])
  );

  return {
    schemaVersion: 1,
    service: 'AI充电站日报',
    date: digest.date,
    generatedAt: digest.generatedAt || null,
    timezone: digest.timezone || 'Asia/Shanghai',
    windowLabel: digest.windowLabel || null,
    summary: {
      totalItems: Array.isArray(digest.items) ? digest.items.length : 0,
      mustRead: sections.mustRead.length,
      creatorUpdates: sections.creatorUpdates.length,
      officialUpdates: sections.officialUpdates.length,
      aihotPicks: sections.aihotPicks.length,
      sources: sanitizeSources(digest),
    },
    sections,
  };
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    id: cleanString(item.id) || cleanString(item.url) || cleanString(item.title),
    title: cleanString(item.translation?.title) || cleanString(item.title),
    summary: cleanString(item.translation?.summary) || cleanString(item.summary),
    source: cleanString(item.externalSource) || cleanString(item.sourceName),
    sourceId: cleanString(item.sourceId),
    category: cleanString(item.category) || null,
    publishedAt: cleanString(item.publishedAt) || null,
    links: {
      original: cleanString(item.url) || null,
    },
  }));
}

function sanitizeSources(digest) {
  if (!Array.isArray(digest.sourcesChecked)) {
    return [];
  }

  return digest.sourcesChecked.map((source) => {
    const health = digest.sourceHealth?.[source.id] || {};
    return {
      id: cleanString(source.id),
      name: cleanString(source.name),
      group: cleanString(source.group) || null,
      status: health.ok ? 'ok' : health.fallback ? 'fallback' : 'failed',
      itemCount: Number.isFinite(health.itemCount) ? health.itemCount : Number.isFinite(health.count) ? health.count : 0,
    };
  });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
