#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

import { fetchAiHotFlowItems } from '../src/aihot-flow-fetch.js';
import { mergeAiHotFlowStore } from '../src/aihot-flow-store.js';
import { loadEnvFiles } from './env.js';

loadEnvFiles();

const rootDir = process.cwd();
const startedAt = new Date();
const workflowPath = join(rootDir, 'data/flow/latest-workflow.json');

main().catch(async (error) => {
  const workflow = {
    ok: false,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  await writeWorkflow(workflowPath, workflow);
  console.error(workflow.error);
  process.exitCode = 1;
});

async function main() {
  const rsshub = await ensureRssHub();
  const flow = await fetchAiHotFlowItems({ now: startedAt, includeHourlySources: true });
  const store = await mergeAiHotFlowStore({
    storePath: join(rootDir, 'data/flow/aihot-items.json'),
    incomingItems: flow.items,
    feedbackPath: join(rootDir, 'data/flow/feedback.json'),
    digestDir: join(rootDir, 'data/digests'),
    now: startedAt,
    retentionDays: Number(process.env.AIHOT_FLOW_RETENTION_DAYS || 30),
  });
  const workflow = {
    ok: Boolean(flow.sourceHealth['aihot-api']?.ok),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    rsshub,
    store: store.stats,
    sourceHealth: flow.sourceHealth,
  };

  await writeWorkflow(workflowPath, workflow);
  console.log(JSON.stringify(workflow, null, 2));

  if (!workflow.ok) {
    process.exitCode = 1;
  }
}

async function ensureRssHub() {
  if (await isRssHubReachable()) {
    return { ok: true, started: false };
  }

  const start = await runNodeScript('scripts/start-rsshub.js', 15_000);
  if (!start.ok) {
    return { ok: false, started: false, error: start.error };
  }

  const ok = await waitForRssHub(10_000);
  return { ok, started: true, error: ok ? null : 'RSSHub started but did not become reachable in time.' };
}

async function waitForRssHub(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isRssHubReachable()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function isRssHubReachable() {
  const url = process.env.RSSHUB_BASE_URL || 'http://127.0.0.1:1200';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function runNodeScript(script, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: rootDir,
      env: process.env,
      stdio: 'ignore',
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: `${script} timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, error: code === 0 ? null : `${script} exited with code ${code}` });
    });
  });
}

async function writeWorkflow(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
