import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIGEST_FILE_RE = /^\d{4}-\d{2}-\d{2}\.json$/;

export async function buildDigestIndex(outputDir = 'data') {
  const digestsDir = join(outputDir, 'digests');
  const files = (await readdir(digestsDir)).filter((file) => DIGEST_FILE_RE.test(file)).sort();
  const entries = [];

  for (const file of files) {
    const digest = JSON.parse(await readFile(join(digestsDir, file), 'utf8'));
    entries.push({
      date: digest.date,
      generatedAt: digest.generatedAt,
      windowLabel: digest.windowLabel || null,
      totalItems: Array.isArray(digest.items) ? digest.items.length : 0,
      json: `digests/${file}`,
      markdown: `digests/${file.replace(/\.json$/, '.md')}`,
    });
  }

  const index = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    latestDate: entries.at(-1)?.date || null,
    entries: entries.reverse(),
  };

  await writeFile(join(digestsDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  return index;
}
