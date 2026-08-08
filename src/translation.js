const BLOCKED_TRANSLATION_SOURCES = new Set(['local-glossary']);
const MIN_ENGLISH_WORDS_FOR_BLOCK = 20;
const MIN_ENGLISH_CHARS_FOR_BLOCK = 140;

export function buildReadableTranslation({ providedTitle = '', providedSummary = '', source = 'manual' } = {}) {
  return normalizeReadableTranslation({
    title: providedTitle,
    summary: providedSummary,
    source,
  });
}

export function normalizeReadableTranslation(translation) {
  if (!translation) {
    return null;
  }

  const source = cleanValue(translation.source || 'manual');
  if (BLOCKED_TRANSLATION_SOURCES.has(source)) {
    return null;
  }

  const title = cleanValue(translation.title);
  const summary = cleanValue(translation.summary);
  if (!title && !summary) {
    return null;
  }

  return {
    title,
    summary,
    source,
  };
}

export function shouldTranslateTextBlock({ title = '', summary = '' } = {}) {
  return isLongEnglishBlock(title, summary) || isClaudeBlogPlaceholder(title, summary);
}

function isClaudeBlogPlaceholder(title, summary) {
  if (cleanValue(summary).toLowerCase() !== 'claude blog update') {
    return false;
  }

  const cleanTitle = cleanValue(title);
  const englishWords = [...cleanTitle.matchAll(/[A-Za-z][A-Za-z0-9'’-]*/g)].length;
  const englishChars = [...cleanTitle.matchAll(/[A-Za-z]/g)].length;
  const chineseChars = [...cleanTitle.matchAll(/[\u4e00-\u9fff]/g)].length;

  return englishWords >= 4 && englishChars > chineseChars * 3;
}

function isLongEnglishBlock(title, summary) {
  const text = cleanValue(`${title || ''} ${summary || ''}`);
  if (!text) {
    return false;
  }

  const englishWords = [...text.matchAll(/[A-Za-z][A-Za-z0-9'’-]*/g)].length;
  const englishChars = [...text.matchAll(/[A-Za-z]/g)].length;
  const chineseChars = [...text.matchAll(/[\u4e00-\u9fff]/g)].length;
  const englishDominant = chineseChars === 0 || englishChars > chineseChars * 3;

  return englishDominant && (englishWords >= MIN_ENGLISH_WORDS_FOR_BLOCK || englishChars >= MIN_ENGLISH_CHARS_FOR_BLOCK);
}

function cleanValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
