#!/usr/bin/env node
import { loadEnvFiles } from './env.js';

loadEnvFiles();

const baseUrl = process.env.RSSHUB_BASE_URL || 'http://127.0.0.1:1200';

try {
  const response = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  console.log(`RSSHub reachable at ${baseUrl}`);
} catch (error) {
  console.error(`RSSHub is not reachable at ${baseUrl}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
