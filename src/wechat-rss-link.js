export function findFeedUrl(items, names) {
  const normalizedNames = names.map(normalizeText).filter(Boolean);
  const matched = items.find((item) => {
    const title = normalizeText(item.title);
    return normalizedNames.some((name) => title.includes(name));
  });

  return matched?.url || '';
}

export function upsertEnvValue(text, key, value) {
  const lines = String(text || '').split(/\r?\n/);
  let updated = false;
  const nextLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!updated) {
    if (nextLines.at(-1) !== '') {
      nextLines.push('');
    }
    nextLines[nextLines.length - 1] = `${key}=${value}`;
    nextLines.push('');
  }

  return `${nextLines.join('\n').replace(/\n*$/, '')}\n`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '');
}
