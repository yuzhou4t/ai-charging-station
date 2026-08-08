# Windows AI 资讯接入

这个目录可以直接复制到 Windows。只需要安装 Node.js 20 或更高版本，不需要执行 `npm install`。

## 快速使用

```powershell
node .\ai-news-client.mjs brief
```

`brief` 会同时读取：

- AI充电站最新公开日报；
- 过去 24 小时的 AI 产品；
- 最近 7 天的 AI 论文；
- 最近 7 天的 AI 与金融内容；
- 最近 7 天的 Codex 与开发工作流内容。

其他命令：

```powershell
node .\ai-news-client.mjs daily
node .\ai-news-client.mjs hot-topics
node .\ai-news-client.mjs items --window 24h --limit 20
node .\ai-news-client.mjs items --window 7d --category paper --limit 20
node .\ai-news-client.mjs items --window 7d --query 金融 --limit 20
```

脚本会使用 ETag 保存本地缓存，未变化的内容不会重复下载。默认缓存目录为 `%LOCALAPPDATA%\ai-news-client`。

## 给 Agent 的调用原则

1. 日常主动简报调用 `brief`，先展示 3～5 条最重要内容，其余按需展开。
2. 用户询问“最近有什么 AI 新闻”时调用 `items --window 24h`。
3. 用户询问“现在最热的事件”时调用 `hot-topics`。
4. 查询失败时如实报告，不使用模型记忆伪造最新新闻。
5. AI HOT 最快每 60 秒查询一次，热点最快每 5 分钟查询一次。

公开日报地址：

```text
https://raw.githubusercontent.com/yuzhou4t/ai-charging-station/assistant-feed/latest.json
```

AI HOT OpenAPI：

```text
https://aihot.virxact.com/openapi-v1.json
```
