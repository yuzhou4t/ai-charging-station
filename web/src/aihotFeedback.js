const VALID_RATINGS = new Set(['good', 'down']);

export const AIHOT_FEEDBACK_STORAGE_KEY = 'ai-charging-station.aihotFeedback.v1';

export function isAiHotFeedbackItem(item) {
  return item?.group === 'aihot' || item?.sourceId === 'aihot';
}

export function feedbackItemKey(item) {
  if (item?.id) {
    return `id:${item.id}`;
  }
  if (item?.url) {
    return `url:${item.url}`;
  }
  return `title:${String(item?.title || '').trim()}`;
}

export function buildFeedbackCommand(item, rating) {
  const safeRating = normalizeRating(rating);
  const tags = feedbackTags(item);
  const tagsArg = tags.length ? ` --tags=${shellArg(tags.join(','))}` : '';
  if (item?.url) {
    return `npm run feedback -- --rating=${safeRating} --url=${shellArg(item.url)}${tagsArg}`;
  }
  if (item?.id) {
    return `npm run feedback -- --rating=${safeRating} --id=${shellArg(item.id)}${tagsArg}`;
  }
  return `npm run feedback -- --rating=${safeRating} --title=${shellArg(item?.title || '')}${tagsArg}`;
}

export function buildFeedbackPayload(item, rating) {
  const safeRating = normalizeRating(rating);
  return {
    title: String(item?.title || '').trim(),
    url: String(item?.url || '').trim(),
    sourceId: String(item?.sourceId || 'aihot').trim(),
    sourceName: String(item?.sourceName || 'AI HOT').trim(),
    rating: safeRating,
    tags: feedbackTags(item),
  };
}

export function updateFeedbackState(current, item, rating, now = new Date()) {
  const safeRating = normalizeRating(rating);
  const key = feedbackItemKey(item);
  return {
    ...(current || {}),
    [key]: {
      rating: safeRating,
      command: buildFeedbackCommand(item, safeRating),
      updatedAt: now.toISOString(),
    },
  };
}

export function readFeedbackState(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(AIHOT_FEEDBACK_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function writeFeedbackState(state, storage = globalThis.localStorage) {
  storage.setItem(AIHOT_FEEDBACK_STORAGE_KEY, JSON.stringify(state || {}));
}

function normalizeRating(rating) {
  const value = String(rating || '').trim();
  if (!VALID_RATINGS.has(value)) {
    throw new Error(`Invalid feedback rating: ${rating}`);
  }
  return value;
}

function feedbackTags(item) {
  return [...new Set([item?.category, item?.externalSource].map(cleanTag).filter(Boolean))].slice(0, 3);
}

function cleanTag(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function shellArg(value) {
  const text = String(value || '');
  if (/^[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/(["\\$`])/g, '\\$1')}"`;
}
