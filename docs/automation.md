# Codex 自动化

`AI充电站日报` 每天北京时间 08:00 运行一次，目标是在本项目中推送过去 24 小时的新增日报。

为了避开 Codex 自动化会话的网络/localhost 权限限制，抓取动作由 macOS LaunchAgent 在本机先运行：

```bash
npm run daily
```

它会写出：

- `data/latest-report.txt`：Codex 自动化要直接转述的摘要。
- `data/latest-workflow.json`：本机抓取流程状态。
- `logs/daily-workflow.log`：本机抓取详细日志。

本机 LaunchAgent 使用 `launchd/com.ai-charging-station.daily.plist`，默认每天 07:55 运行；Codex 自动化 08:00 只读结果并推送。

本机抓取任务应执行：

```bash
npm run rsshub:doctor || npm run rsshub:start
npm run forgerss:xhs || true
npm run digest
npm run report
```

任务完成后检查输出：

- `data/latest.json`
- `data/digests/YYYY-MM-DD.json`
- `data/digests/YYYY-MM-DD.md`

Codex 自动化汇报不只报成功数，还应直接转述 `data/latest-report.txt` 的“内容摘要”：过去 24 小时有哪些新增文章/笔记、来自哪个源、主要讲了什么。没有新增时要明确说“过去 24 小时未发现新增内容”，不要用旧内容凑日报。

如果 Codex 自动化里出现 `EPERM`、`ENOTFOUND` 或 `fetch failed`，说明它又在沙盒里跑了抓取命令；应恢复为只读 `data/latest-report.txt`。真正的网络抓取只应由本机 LaunchAgent 执行。

RSSHub 启动脚本会读取项目根目录的 `.env` 和 `.env.local`。B站、小红书源要稳定运行时，优先在 `.env` 中配置 `BILIBILI_COOKIE_1`、`XIAOHONGSHU_COOKIE`。如果 RSSHub 或平台 Cookie 不可用，对应源会在 `sourceHealth` 中标记失败，但日报仍会包含其它可用源。

小红书源默认 30 分钟内最多请求一次，状态记录在 `data/source-state.json`。这会减少手动重跑时对小红书的连续访问，降低触发安全验证的概率，但不会把手动排查锁死到第二天。

如果小红书当天触发安全验证，日报会使用兜底内容：先读 `data/manual-links.json` 的手动补链，再读 `data/source-state.json` 的最近成功缓存。兜底命中时，`sourceHealth.<sourceId>.fallback` 为 `true`，Markdown 源状态显示 `FALLBACK`。

ForgeRSS 小红书侧车源会生成 `data/forgerss/*.xml`。首次使用前需要在本机运行 `npm run forgerss:xhs:login` 完成小红书登录 Profile；之后自动化中的 `npm run forgerss:xhs || true` 会尽量刷新侧车 RSS，失败也不阻断日报。
