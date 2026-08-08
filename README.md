# AI充电站

创作者优先的每日 AI 日报生成器。Codex 自动化每天运行脚本，抓取指定创作者、官方博客和 AI HOT，输出给前端使用的 JSON 与给人阅读的 Markdown。默认日报只汇报过去 24 小时内首次发现的新内容；已推过的链接会进入已读基线，不会每天重复出现。

## 运行

```bash
npm test
npm run digest
npm run translate:digest
npm run report
npm run index
npm run backfill:7d
DIGEST_DATE=2026-06-08 npm run digest
npm run digest -- --date=2026-06-08
npm run feedback -- --rating=good --id=aihot-xxxx --tags="codex,automation"
npm run feedback -- --rating=down --title="不太想看的标题" --tags="低相关"
```

输出位置：

- `data/digests/YYYY-MM-DD.json`
- `data/digests/YYYY-MM-DD.md`
- `data/latest.json`

## 版本管理

本地仓库用于记录项目代码、脚本和文档的演进；每完成一次功能或文档改动并验证后，提交一次 Git commit：

```bash
git status --short
git diff -- <本次改动文件>
npm test  # 代码变更时运行
git add <本次改动文件>
git commit -m "描述这次改动"
```

如果只补 `data/digests/` 里的历史日报翻译，通常不需要提交，因为日报 JSON/Markdown 属于本地生成结果，已被 `.gitignore` 忽略。真正需要长期保留的规则、脚本或说明，应该写进 `src/`、`scripts/` 或 `README.md` 后再提交。

## RSSHub

默认读取 `RSSHUB_BASE_URL=http://127.0.0.1:1200`。本机当前没有 Docker，因此 v1 按 Node 本地服务接 RSSHub：

当前项目默认把 RSSHub 放在 `vendor/RSSHub`，启动为本地后台服务：

```bash
npm run rsshub:start
npm run rsshub:doctor
npm run rsshub:stop
```

本项目启动脚本会读取 `.env` 和 `.env.local`。需要平台登录态时，复制 `.env.example` 为 `.env`，按需填写：

- `BILIBILI_COOKIE_1`：B 站 412、-352、-403 风控时需要。
- `XIAOHONGSHU_COOKIE`：小红书匿名访问不稳定时需要。
- `NEWRANK_COOKIE`：当前源列表不再使用；如果以后重新启用新榜公众号路由再填写。

这些 Cookie 只在本机 RSSHub 进程里使用，不要提交到版本管理。小红书和 B 站路由失败时，日报仍会生成，并在 `sourceHealth` 与 Markdown 的“源健康状态和缺失说明”里标记。

小红书源默认带 30 分钟请求间隔，运行状态记录在 `data/source-state.json`。这样手动反复运行日报时会跳过过近的小红书请求，减少触发安全验证的概率，但不会把手动排查锁死到 24 小时后。

日报会在 `data/source-state.json` 的 `seenItems` 中记录每个源已经见过的链接或标题。某个源第一次接入时会先建立已读基线，本次不推历史 feed；之后只推相对基线新增、且落在默认过去 24 小时窗口内的内容。

## OpenAI News

OpenAI News 已作为官方源接入，源配置在 `src/sources.js`：

- 源 id：`openai-news`
- 主页：`https://openai.com/news/`
- RSS：`https://openai.com/news/rss.xml`
- 分区：`official`，会显示在“官方/行业补充”和发布者概览里。

这个源直接读取 OpenAI 官方 RSS，不依赖本地 RSSHub、Cookie 或浏览器登录态。每日自动化仍走同一条链路：

```bash
npm run daily
```

第一次运行会在 `data/source-state.json` 里为 `openai-news` 建立已读基线，不推送 OpenAI 的历史文章；之后 OpenAI News 新发文章时，只要文章在默认过去 24 小时窗口内且没有被 `seenItems.openai-news` 记录过，就会进入当天日报，并写入：

- `data/digests/YYYY-MM-DD.json`
- `data/digests/YYYY-MM-DD.md`
- `data/latest-report.txt`

Codex 自动化每天北京时间 08:00 读取 `data/latest-report.txt` 转述推送，因此 OpenAI News 后续新文章会随每日摘要一起推送。手动验证源配置可以运行：

```bash
node --test test/sources.test.js
npm run digest
```

## 微信公众号

`数字生命卡兹克` 默认先读 `.env` 里的 `WECHAT_KHAZIX_RSS_URL`。这个 URL 适合填本地 we-mp-rss 里订阅公众号后生成的 RSS 地址；如果没有填写，才退回 RSSHub 的搜狗微信和 uread 间接路由。

推荐流程：

1. 启动 we-mp-rss。
2. 打开 `http://127.0.0.1:8001`。
3. 在 we-mp-rss 里扫码授权并订阅 `数字生命卡兹克` / `Rockhazix`。
4. 自动把该订阅的 RSS 地址写入 `.env`：

```bash
npm run wechat:link
```

也可以手动复制该订阅的 RSS 地址，填入 `.env`：

```bash
WE_MP_RSS_BASE_URL=http://127.0.0.1:8001
WECHAT_KHAZIX_RSS_URL=http://127.0.0.1:8001/...
```

验证：

```bash
npm run werss:start
npm run wechat:doctor
npm run digest
```

如果 `WECHAT_KHAZIX_RSS_URL` 有效，日报会优先用它；如果它暂时不可用，脚本会继续尝试 RSSHub 间接路由，不会阻断整份日报。

## 小红书兜底

小红书抓取失败或被冷却跳过时，日报会依次读取：

- `data/manual-links.json`：手动补链。
- `data/forgerss/*.xml`：ForgeRSS 侧车生成的本地 RSS。
- `data/source-state.json`：最近一次成功抓取留下的缓存。

命中的兜底内容会进入 `items` 和“创作者更新”，源状态显示为 `FALLBACK`。

手动补链格式：

```json
{
  "xhs-zhangzala": [
    {
      "title": "笔记标题",
      "url": "https://www.xiaohongshu.com/explore/...",
      "summary": "为什么值得看",
      "publishedAt": "2026-06-10T08:00:00+08:00"
    }
  ],
  "xhs-khazix": []
}
```

### ForgeRSS 侧车

ForgeRSS 已放在 `vendor/ForgeRSS`。首次使用需要安装依赖并登录一次小红书：

```bash
python3 -m venv vendor/ForgeRSS/.venv
vendor/ForgeRSS/.venv/bin/python -m pip install -r vendor/ForgeRSS/requirements.txt
npm run forgerss:xhs:login
```

登录完成后，生成小红书本地 RSS：

```bash
npm run forgerss:xhs
```

脚本会把 ForgeRSS 默认输出拆成 AI充电站可读的文件：

- `data/forgerss/xhs-zhangzala.xml`
- `data/forgerss/xhs-khazix.xml`

`.env` 中可选填写：

- `FORGERSS_XHS_ZHANGZALA`：张咋啦完整小红书主页 URL。
- `FORGERSS_XHS_KHAZIX`：数字生命卡兹克完整小红书主页 URL。

如果不填，脚本会退回使用源配置里的普通主页 URL；从浏览器复制带 `xsec_token` / `xsec_source` 的完整 URL 通常更稳。

## 数据契约

日报 JSON 顶层字段：

- `date`
- `generatedAt`
- `timezone`
- `sourcesChecked`
- `sourceHealth`
- `items`
- `sections`
- `editorNotes`

前端推荐读取 `data/latest.json`，再根据其中的 `json` 字段加载当天日报。

历史回填使用 `npm run backfill:7d`。它默认生成昨天往前 7 个完整北京时间自然日的日报，并在结束后恢复 `data/latest.json` 和 `data/source-state.json`，避免历史回填影响每日新增基线。

历史列表读取 `data/digests/index.json`。它会列出已有日报的日期、路径、统计窗口和条目数；`npm run index` 可单独重建。

## 自动化汇报

`npm run digest` 结束时会直接打印一段“内容摘要”，包括今日必看、创作者更新、官方/行业补充和 AI HOT 精选。已经生成过日报时，也可以单独运行：

```bash
npm run report
```

报告会先按发布者汇总“谁发了什么”，再列今日必看和各分区内容；源健康状态只放在后面的提醒区。

英文标题/摘要不再在前端现场机翻，也不再使用本地词表替换。生成日报后，如果需要给大段英文补中文侧栏，先配置外部翻译 API，再运行：

```bash
DEEPSEEK_API_KEY=... npm run translate:digest
npm run translate:digest -- --date=2026-06-08
```

默认翻译配置已对齐 TTS 项目：`DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions`，`DEEPSEEK_MODEL=deepseek-v4-flash`。如果以后想换别的 OpenAI-compatible 服务，可以用 `TRANSLATION_API_URL`、`TRANSLATION_API_KEY`、`TRANSLATION_MODEL` 覆盖。脚本只会把标题+摘要明显属于大段英文的条目送翻译；中文正文里夹杂 OpenAI、Codex、SDK、agent 等术语不会触发。翻译结果会写入日报 JSON 的 `translation` 字段，并同步刷新 Markdown。前端卡片和命令行报告只展示 `aihot`、`manual`、`external-api` 等可信来源的译文；历史遗留的 `local-glossary` 会被清理，不再显示。

`npm run daily` 会在生成日报后先检测是否存在大段英文标题/摘要。有翻译 API key 时会自动运行同一套翻译流程，并在翻译后复检；如果仍有漏翻、翻译 API 失败，或缺少 key 但检测到待翻译英文，流程会停止在汇报前，不刷新索引、不输出日报汇报。只有没有待翻译英文，或英文已经写入可信译文后，才会继续后面的推送/汇报步骤。

## AI HOT 筛选反馈

AI HOT 条目可以记录本地偏好，文件在 `data/feedback/items.json`。`good` 会提升精确条目和同类标签内容；`down` 会降低精确条目和同类标签内容的权重，但不会直接屏蔽。`hide` 只用于精确隐藏某一条；如果 `hide` 带了 `tags`，匹配这些标签的后续内容也只是降低权重。

前端里的 AI HOT 卡片也有轻量反馈按钮。开发模式下会通过 `/api/feedback` 直接写入本地反馈文件；如果接口不可用，会保存在浏览器本地并复制一条可执行的 `npm run feedback` 命令，方便手动补写。

最省事的方式是用最新日报里的条目 id：

```bash
npm run feedback -- --rating=good --id=aihot-xxxx --tags="codex,automation" --note="适合继续跟"
npm run feedback -- --rating=down --id=aihot-yyyy --tags="低相关"
```

也可以直接按标题或链接记录：

```bash
npm run feedback -- --rating=down --title="某个不太需要的标题"
```

Codex 定时任务如果在普通运行环境里看到 `EPERM`、`ENOTFOUND` 或 `fetch failed`，通常是网络权限层拦住了本地 RSSHub 或外网请求；这时需要用本机网络权限重跑抓取命令。

## Windows 助理只读接口

AI充电站可以在每日工作流成功后，将脱敏快照发布到专用 `assistant-feed` 分支。公开内容只包含标题、摘要、来源、原文链接、发布时间和简化后的源状态，不包含本机路径、日志、Cookie、反馈记录或其他个人数据。

在本机 `.env` 中启用：

```bash
AI_CHARGING_STATION_PUBLIC_FEED_ENABLED=1
```

手动构建和发布：

```bash
npm run public:build
npm run public:publish
```

Windows 助理的固定读取地址：

```text
https://raw.githubusercontent.com/yuzhou4t/ai-charging-station/assistant-feed/latest.json
```

`windows-client/` 提供无需安装依赖的 Node.js 客户端，同时接入公开日报和 AI HOT 稳定 `/api/v1` 接口。
