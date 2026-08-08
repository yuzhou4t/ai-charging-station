#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPendingTranslationItems, hasExternalTranslatorConfig } from '../src/translate-digest.js';
import { loadEnvFiles } from './env.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(rootDir, 'data');
const logsDir = join(rootDir, 'logs');
const logPath = join(logsDir, 'daily-workflow.log');
const reportPath = join(dataDir, 'latest-report.txt');
const statePath = join(dataDir, 'latest-workflow.json');

const startedAt = new Date().toISOString();
const steps = [];

loadEnvFiles();
await mkdir(dataDir, { recursive: true });
await mkdir(logsDir, { recursive: true });
await appendLog(`\n=== AI充电站 daily workflow ${startedAt} ===\n`);

const firstDoctor = await runNodeStep('rsshub:doctor', ['scripts/check-rsshub.js'], { allowFailure: true, timeoutMs: 10_000 });
if (firstDoctor.exitCode !== 0) {
  await runNodeStep('rsshub:start', ['scripts/start-rsshub.js'], { allowFailure: true, timeoutMs: 15_000 });
  await sleep(2000);
  await runNodeStep('rsshub:doctor:after-start', ['scripts/check-rsshub.js'], { allowFailure: true, timeoutMs: 10_000 });
}

await runNodeStep('forgerss:xhs', ['scripts/run-forgerss-xhs.js'], {
  allowFailure: true,
  timeoutMs: Number(process.env.FORGERSS_WORKFLOW_TIMEOUT_MS || 180_000),
});
const digest = await runNodeStep('digest', ['scripts/generate-digest.js'], {
  timeoutMs: Number(process.env.DIGEST_WORKFLOW_TIMEOUT_MS || 300_000),
});
const translationWarnings = [];
if (digest.exitCode === 0) {
  if (hasExternalTranslatorConfig(process.env)) {
    const translation = await runNodeStep('translate:digest', ['scripts/translate-digest.js'], {
      allowFailure: true,
      timeoutMs: Number(process.env.TRANSLATE_DIGEST_WORKFLOW_TIMEOUT_MS || 180_000),
    });
    if (translation.exitCode !== 0) {
      const warning = '英文标题/摘要翻译失败，本次继续生成未翻译日报。请检查翻译 API 配置后重跑 npm run translate:digest。';
      translationWarnings.push(warning);
      await recordWarningStep('translate:warning', warning);
    }

    const pending = await findLatestPendingTranslations();
    if (pending.length) {
      const warning = formatPendingTranslationBlock(pending, '英文标题/摘要仍有未翻译项，本次继续生成未翻译日报。');
      translationWarnings.push(warning);
      await recordWarningStep('translate:verify', warning);
    }
  } else {
    const pending = await findLatestPendingTranslations();
    if (pending.length) {
      const warning = formatPendingTranslationBlock(
        pending,
        '检测到大段英文标题/摘要，但缺少 DEEPSEEK_API_KEY 或 TRANSLATION_API_KEY，本次继续生成未翻译日报。'
      );
      translationWarnings.push(warning);
      await recordSkippedStep('translate:digest', warning);
    } else {
      await recordSkippedStep('translate:digest', '没有检测到需要翻译的大段英文标题/摘要，跳过翻译。');
    }
  }
} else {
  await recordSkippedStep('translate:digest', 'digest 失败，跳过翻译。');
}

let index = { exitCode: 1, stdout: '', stderr: '' };
let report = { exitCode: 1, stdout: '', stderr: '' };
if (digest.exitCode === 0) {
  index = await runNodeStep('index', ['scripts/build-digest-index.js'], { timeoutMs: 30_000 });
  report = await runNodeStep('report', ['scripts/report-digest.js'], { allowFailure: true, timeoutMs: 30_000 });
} else {
  await recordSkippedStep('index', 'digest 失败，跳过索引刷新。');
  await recordSkippedStep('report', 'digest 失败，跳过日报汇报。');
}

const finishedAt = new Date().toISOString();
const ok = digest.exitCode === 0 && index.exitCode === 0 && report.exitCode === 0;
let reportText = report.stdout.trim() || digest.stdout.trim() || 'AI充电站日报未生成可读摘要，请检查 logs/daily-workflow.log。';
if (translationWarnings.length) {
  reportText = `${reportText}\n\n## 翻译提醒\n${[...new Set(translationWarnings)].join('\n')}`;
}

await writeFile(reportPath, `${reportText}\n`, 'utf8');
await writeFile(
  statePath,
  `${JSON.stringify(
    {
      ok,
      startedAt,
      finishedAt,
      reportPath,
      logPath,
      steps,
    },
    null,
    2
  )}\n`,
  'utf8'
);

console.log(reportText);
process.exitCode = ok ? 0 : 1;

async function runNodeStep(name, args, options = {}) {
  const result = await runProcess(process.execPath, args, {
    cwd: rootDir,
    timeoutMs: options.timeoutMs,
  });
  steps.push({
    name,
    exitCode: result.exitCode,
    ok: result.exitCode === 0,
    allowFailure: Boolean(options.allowFailure),
    timedOut: Boolean(result.timedOut),
  });
  await appendStepLog(name, result);

  if (result.exitCode !== 0 && !options.allowFailure) {
    return result;
  }
  return result;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolveStep) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let closed = false;
    let timedOut = false;

    const timeout =
      options.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            stderr += `Timed out after ${options.timeoutMs}ms\n`;
            killProcessGroup(child.pid, 'SIGTERM');
            setTimeout(() => killProcessGroup(child.pid, 'SIGKILL'), 5000).unref();
          }, options.timeoutMs)
        : null;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      stderr += `${error.message}\n`;
    });
    child.on('close', (code) => {
      if (closed) {
        return;
      }
      closed = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      resolveStep({ exitCode: timedOut ? 124 : code || 0, stdout, stderr, timedOut });
    });
  });
}

async function appendStepLog(name, result) {
  const lines = [`\n--- ${name} exit=${result.exitCode}${result.timedOut ? ' timeout=true' : ''} ---`];
  if (result.stdout.trim()) {
    lines.push(result.stdout.trim());
  }
  if (result.stderr.trim()) {
    lines.push('[stderr]');
    lines.push(result.stderr.trim());
  }
  await appendLog(`${lines.join('\n')}\n`);
}

async function recordSkippedStep(name, reason) {
  steps.push({
    name,
    exitCode: 0,
    ok: true,
    skipped: true,
    reason,
  });
  await appendLog(`\n--- ${name} skipped ---\n${reason}\n`);
}

async function recordWarningStep(name, reason) {
  steps.push({
    name,
    exitCode: 0,
    ok: true,
    warning: true,
    reason,
  });
  await appendLog(`\n--- ${name} warning ---\n${reason}\n`);
}

async function findLatestPendingTranslations() {
  try {
    const latest = JSON.parse(await readFile(join(dataDir, 'latest.json'), 'utf8'));
    const digestPath = join(dataDir, latest.json || `digests/${latest.date}.json`);
    const latestDigest = JSON.parse(await readFile(digestPath, 'utf8'));
    return findPendingTranslationItems(latestDigest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      {
        id: 'unknown',
        sourceName: 'latest digest',
        title: `无法读取最新日报进行翻译检查：${message}`,
      },
    ];
  }
}

function formatPendingTranslationBlock(items, heading) {
  const lines = [heading, '待翻译条目：'];
  for (const item of items.slice(0, 10)) {
    const source = item.sourceName ? `${item.sourceName} · ` : '';
    lines.push(`- ${source}${item.title || item.id}`);
  }
  if (items.length > 10) {
    lines.push(`- 另有 ${items.length - 10} 条未列出`);
  }
  return lines.join('\n');
}

function killProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Process already exited.
    }
  }
}

function appendLog(text) {
  return appendFile(logPath, text, 'utf8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
