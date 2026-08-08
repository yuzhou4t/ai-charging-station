#!/usr/bin/env node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

import { buildPublicDailyFromDisk } from './build-public-daily.js';

const repository = process.env.AI_CHARGING_STATION_PUBLIC_FEED_REPO || 'https://github.com/yuzhou4t/ai-charging-station.git';
const branch = process.env.AI_CHARGING_STATION_PUBLIC_FEED_BRANCH || 'assistant-feed';
const rawUrl = process.env.AI_CHARGING_STATION_PUBLIC_FEED_URL ||
  `https://raw.githubusercontent.com/yuzhou4t/ai-charging-station/${branch}/latest.json`;
const parentDir = await mkdtemp(join(tmpdir(), 'ai-charging-station-public-'));
const checkoutDir = join(parentDir, 'feed');

try {
  const { payload } = await buildPublicDailyFromDisk();
  await mkdir(checkoutDir, { recursive: true });
  await runGit(['init'], checkoutDir);
  await runGit(['remote', 'add', 'origin', repository], checkoutDir);

  const fetchResult = await runGit(['fetch', '--depth=1', 'origin', branch], checkoutDir, { allowFailure: true });
  if (fetchResult.exitCode === 0) {
    await runGit(['checkout', '-B', branch, 'FETCH_HEAD'], checkoutDir);
  } else {
    await runGit(['checkout', '--orphan', branch], checkoutDir);
  }

  await writeFile(join(checkoutDir, 'latest.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(
    join(checkoutDir, 'README.md'),
    '# AI充电站公开日报接口\n\n该分支只保存脱敏后的最新日报，供个人 AI 助理只读查询。\n',
    'utf8'
  );
  await runGit(['config', 'user.name', 'AI Charging Station Bot'], checkoutDir);
  await runGit(['config', 'user.email', 'ai-charging-station@users.noreply.github.com'], checkoutDir);
  await runGit(['add', 'README.md', 'latest.json'], checkoutDir);

  const diff = await runGit(['diff', '--cached', '--quiet'], checkoutDir, { allowFailure: true });
  if (diff.exitCode === 1) {
    await runGit(['commit', '-m', `Update public daily ${payload.date}`], checkoutDir);
    await runGit(['push', 'origin', `HEAD:refs/heads/${branch}`], checkoutDir);
  } else if (diff.exitCode !== 0) {
    throw new Error(diff.stderr || '无法判断公开日报是否发生变化。');
  }

  console.log(JSON.stringify({ ok: true, date: payload.date, url: rawUrl }, null, 2));
} finally {
  await rm(parentDir, { recursive: true, force: true });
}

function runGit(args, cwd, options = {}) {
  return new Promise((resolveStep, rejectStep) => {
    const child = spawn('/usr/bin/git', args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectStep);
    child.on('close', (code) => {
      const result = { exitCode: code || 0, stdout, stderr };
      if (result.exitCode !== 0 && !options.allowFailure) {
        rejectStep(new Error(stderr.trim() || `git ${args[0]} 失败，退出码 ${result.exitCode}`));
        return;
      }
      resolveStep(result);
    });
  });
}
