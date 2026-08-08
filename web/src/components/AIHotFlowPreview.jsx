import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Bookmark,
  ExternalLink,
  Heart,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
} from 'lucide-react'

const mockItems = [
  {
    id: 'flow-1',
    title: 'ClickUp Brain AI 可自主创建专用智能代理',
    summary:
      '当检测到适合委派的任务时，Brain 会提议构建一个专用 agent，预配置触发器、规则和范围，用来接管重复性工作。',
    source: 'X：Testing Catalog',
    sourceKey: 'testingcatalog',
    category: 'AI 产品',
    publishedAt: '2026-06-21T08:50:33Z',
    heat: 59,
    url: 'https://x.com/testingcatalog/status/2068617557800530050',
  },
  {
    id: 'flow-2',
    title: 'AWS 推出 Continuum 和 Context，补齐智能体业务上下文',
    summary:
      'Context 自动从数据库、文档、邮件等企业数据构建知识图谱，为智能体提供共享业务知识；Continuum 覆盖代码漏洞处理全生命周期。',
    source: 'The Decoder：AI News',
    sourceKey: 'the-decoder',
    category: '行业动态',
    publishedAt: '2026-06-21T08:25:41Z',
    heat: 52,
    url: 'https://the-decoder.com/',
  },
  {
    id: 'flow-3',
    title: '开源教程《Deep Agents 实战》发布',
    summary:
      '基于 LangChain / LangGraph 生态，讲解 Deep Agents Harness 的 Runtime、Framework、Harness 三层架构。',
    source: 'X：邵猛',
    sourceKey: 'shao-meng',
    category: '技巧',
    publishedAt: '2026-06-20T12:16:16Z',
    heat: 75,
    url: 'https://x.com/shao__meng/status/2068306942184034471',
  },
  {
    id: 'flow-4',
    title: 'OpenRouter vs Portkey：团队该选哪个 LLM 网关',
    summary:
      'OpenRouter 更像托管路由网络，Portkey 更像控制平面。两者都覆盖治理、路由和可观测性，但部署和成本结构不同。',
    source: 'OpenRouter：Announcements',
    sourceKey: 'openrouter',
    category: '工具',
    publishedAt: '2026-06-19T19:00:00Z',
    heat: 59,
    url: 'https://openrouter.ai/blog/insights/openrouter-vs-portkey',
  },
  {
    id: 'flow-5',
    title: 'baoyu-design Skill 迭代：修复导出样式与渐变丢失',
    summary:
      '宝玉分享 Skill 迭代循环：自己用、发现问题、让 Agent 分析、出方案、确认、更新，并补齐测试覆盖。',
    source: 'X：宝玉',
    sourceKey: 'dotey',
    category: 'Agent 工作流',
    publishedAt: '2026-06-19T18:43:30Z',
    heat: 75,
    url: 'https://x.com/dotey/status/2068042001895809420',
  },
  {
    id: 'flow-6',
    title: 'Cloudflare 为 AI 智能体推出临时账户',
    summary:
      'AI 智能体可以直接运行 wrangler deploy --temporary，在数秒内获得可用 Worker，降低自动部署门槛。',
    source: 'Cloudflare Blog',
    sourceKey: 'cloudflare',
    category: '基础设施',
    publishedAt: '2026-06-19T13:00:00Z',
    heat: 62,
    url: 'https://blog.cloudflare.com/temporary-accounts',
  },
  {
    id: 'flow-7',
    title: 'Humanize PPT v0.9：为演讲而生的开源 PPT Skill',
    summary:
      '通过 AST 逻辑重排大纲，新增真实预览页、质检修复和演讲模式，让 PPT 生成更贴近实际讲述。',
    source: '公众号：卡尔的AI沃茨',
    sourceKey: 'karl-ai',
    category: '公众号',
    publishedAt: '2026-06-19T09:48:28Z',
    heat: 77,
    url: 'https://mp.weixin.qq.com/',
  },
  {
    id: 'flow-8',
    title: 'OpenAI 为 macOS 版 Codex 推出 Record & Replay 功能',
    summary:
      'Codex 可以观察一次操作并沉淀为可复用技能，适合重复性的白领工作自动化场景。',
    source: 'The Decoder：AI News',
    sourceKey: 'the-decoder',
    category: 'Codex',
    publishedAt: '2026-06-20T13:15:08Z',
    heat: 54,
    url: 'https://the-decoder.com/',
  },
]

const followedSourceKeys = new Set(['dotey', 'shao-meng', 'openrouter', 'cloudflare'])
const fallbackLatestDate = new Date('2026-06-21T09:00:00Z')

const windows = [
  { key: '1h', label: '1 小时' },
  { key: '6h', label: '6 小时' },
  { key: '24h', label: '24 小时' },
  { key: '7d', label: '7 天' },
]

export default function AIHotFlowPreview() {
  const [mode, setMode] = useState('discover')
  const [windowKey, setWindowKey] = useState('24h')
  const [seed, setSeed] = useState(0)
  const [seenIds, setSeenIds] = useState(new Set())
  const [liked, setLiked] = useState(new Set())
  const [saved, setSaved] = useState(new Set())
  const [muted, setMuted] = useState(new Set())
  const [followed, setFollowed] = useState(new Set([...followedSourceKeys]))
  const [flowItems, setFlowItems] = useState(mockItems)
  const [feedStatus, setFeedStatus] = useState({ state: 'loading', fetchedAt: null, now: fallbackLatestDate.toISOString(), error: '' })

  useEffect(() => {
    let alive = true

    async function loadFeed() {
      try {
        const [response, feedbackResponse] = await Promise.all([
          fetch('/api/aihot/items?take=all'),
          fetch('/api/aihot/flow-feedback').catch(() => null),
        ])
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        const feedbackPayload = feedbackResponse?.ok ? await feedbackResponse.json() : { items: [] }
        const items = (payload.items || []).map(normalizeFeedItem).filter((item) => item.title && item.url)
        if (!items.length) throw new Error('empty feed')
        if (alive) {
          setFlowItems(items)
          applyFeedbackState(feedbackPayload.items || [], items, { setLiked, setSaved, setMuted })
          setSeed(Date.now())
          setFeedStatus({
            state: 'ready',
            fetchedAt: payload.fetchedAt || null,
            now: payload.now || new Date().toISOString(),
            error: '',
          })
        }
      } catch (error) {
        if (alive) {
          setFeedStatus({
            state: 'fallback',
            fetchedAt: null,
            now: fallbackLatestDate.toISOString(),
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    loadFeed()

    return () => {
      alive = false
    }
  }, [])

  const displayNow = useMemo(() => {
    const date = new Date(feedStatus.now)
    return Number.isNaN(date.getTime()) ? fallbackLatestDate : date
  }, [feedStatus.now])

  const visibleItems = useMemo(() => {
    const pool = flowItems.filter((item) => {
      if (muted.has(item.id)) return false
      if (mode === 'following' && !followed.has(item.sourceKey)) return false
      if (mode === 'saved' && !saved.has(item.id)) return false
      return withinWindow(item.publishedAt, windowKey, displayNow)
    })

    const batchSize = mode === 'discover' ? 6 : 5
    const unseenPool = pool.filter((item) => !seenIds.has(item.id))
    const batchPool = unseenPool.length >= Math.min(batchSize, pool.length) ? unseenPool : pool

    const scored = batchPool.map((item) => ({
      item,
      rank:
        pseudoRandom(`${item.id}-${seed}`) * 100 +
        item.heat * 0.25 +
        (liked.has(item.id) ? 18 : 0) +
        (saved.has(item.id) ? 10 : 0) +
        (followed.has(item.sourceKey) ? 12 : 0),
    }))

    return scored.sort((a, b) => b.rank - a.rank).map(({ item }) => item).slice(0, batchSize)
  }, [displayNow, flowItems, followed, liked, mode, muted, saved, seed, seenIds, windowKey])

  const toggleLiked = (item) => {
    const nextLiked = !liked.has(item.id)
    setLiked((current) => toggleSetValue(current, item.id))
    persistFlowFeedback(item, {
      liked: nextLiked,
      saved: saved.has(item.id),
      muted: muted.has(item.id),
    })
  }

  const toggleSaved = (item) => {
    const nextSaved = !saved.has(item.id)
    setSaved((current) => toggleSetValue(current, item.id))
    persistFlowFeedback(item, {
      liked: liked.has(item.id),
      saved: nextSaved,
      muted: muted.has(item.id),
    })
  }

  const toggleFollowed = (sourceKey) => {
    setFollowed((current) => toggleSetValue(current, sourceKey))
  }

  const muteItem = (item) => {
    setMuted((current) => new Set([...current, item.id]))
    persistFlowFeedback(item, {
      liked: liked.has(item.id),
      saved: saved.has(item.id),
      muted: true,
    })
  }

  const refreshBatch = () => {
    setSeenIds((current) => {
      const next = new Set(current)
      visibleItems.forEach((item) => next.add(item.id))
      return next
    })
    setSeed((value) => value + 1)
  }

  return (
    <section className="w-full">
      <div className="mb-8 lg:mb-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {formatFeedStatus(feedStatus)}
            </p>
            <h1 className="max-w-2xl text-4xl font-serif font-semibold leading-tight text-slate-900 dark:text-white lg:text-6xl">
              热点动态。
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <ModeButton active={mode === 'discover'} onClick={() => setMode('discover')}>
              发现
            </ModeButton>
            <ModeButton active={mode === 'following'} onClick={() => setMode('following')}>
              特别关注
            </ModeButton>
            <ModeButton active={mode === 'saved'} onClick={() => setMode('saved')}>
              收藏夹
            </ModeButton>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-y border-slate-200 py-4 dark:border-white/[0.08] md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 md:w-72">
            <Search className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">预留搜索：来源、关键词、分类</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {windows.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setWindowKey(item.key)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  windowKey === item.key
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                    : 'border border-slate-200 bg-white/60 text-slate-600 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={refreshBatch}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm shadow-amber-500/20 transition hover:bg-amber-600"
            >
              <RefreshCw className="h-4 w-4" />
              换一批
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div layout className="columns-2 gap-3 md:columns-2 xl:columns-3 xl:gap-4">
          {visibleItems.map((item, index) => (
            <FlowCard
              key={item.id}
              item={item}
              index={index}
              liked={liked.has(item.id)}
              saved={saved.has(item.id)}
              muted={muted.has(item.id)}
              followed={followed.has(item.sourceKey)}
              displayNow={displayNow}
              onLike={() => toggleLiked(item)}
              onSave={() => toggleSaved(item)}
              onFollow={() => toggleFollowed(item.sourceKey)}
              onMute={() => muteItem(item)}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {visibleItems.length === 0 && (
        <div className="rounded-[8px] border border-dashed border-slate-300 bg-white/50 p-8 text-center text-sm text-slate-500 dark:border-white/[0.1] dark:bg-white/[0.03] dark:text-slate-400">
          收藏夹里还没有符合当前时间窗口的内容。
        </div>
      )}

      <div className="mt-8 grid gap-3 border-t border-slate-200 pt-5 text-sm text-slate-500 dark:border-white/[0.08] dark:text-slate-400 md:grid-cols-3">
        <PreviewMetric label="本轮候选" value={`${flowItems.length} 条`} />
        <PreviewMetric label="已关注信源" value={`${followed.size} 个`} />
        <PreviewMetric label="本地反馈" value={`${saved.size} 收藏 / ${liked.size} 喜欢 / ${muted.size} 降噪`} />
      </div>
    </section>
  )
}

function FlowCard({ item, index, liked, saved, muted, followed, displayNow, onLike, onSave, onFollow, onMute }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.035, duration: 0.26 }}
      className="mb-3 break-inside-avoid rounded-[8px] border border-slate-200 bg-white/80 p-3 shadow-sm shadow-slate-200/50 transition-shadow duration-150 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/70 dark:border-white/[0.08] dark:bg-[#111113]/85 dark:shadow-black/30 dark:hover:border-white/[0.14] dark:hover:shadow-black/50 sm:mb-4 sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{item.source}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span>{formatRelative(item.publishedAt, displayNow)}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span>{item.category}</span>
          </div>
        </div>
        <button
          type="button"
          title={followed ? '取消关注信源' : '关注信源'}
          onClick={onFollow}
          className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full transition-colors sm:h-8 sm:w-8 ${
            followed
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-400 dark:hover:bg-white/[0.1]'
          }`}
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>

      <a href={item.url} target="_blank" rel="noreferrer" className="group block w-full text-left">
        <h2 className="text-base font-serif font-semibold leading-snug text-slate-900 transition group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300 sm:text-xl">
          {item.title}
        </h2>
        <p className="mt-2 overflow-hidden text-xs leading-5 text-slate-600 dark:text-slate-300 sm:mt-3 sm:text-sm sm:leading-6">{item.summary}</p>
      </a>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <ActionButton active={liked} label="喜欢" onClick={onLike}>
            <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
          </ActionButton>
          <ActionButton active={muted} label="不感兴趣" onClick={onMute}>
            <ThumbsDown className="h-4 w-4" />
          </ActionButton>
          <ActionButton active={saved} label={saved ? '取消收藏' : '收藏'} onClick={onSave}>
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          </ActionButton>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white"
          title="打开原文"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </motion.article>
  )
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
          : 'border border-slate-200 bg-white/60 text-slate-600 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function ActionButton({ active, children, label, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-full transition-colors sm:h-8 sm:w-8 ${
        active
          ? 'bg-rose-500 text-white'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function PreviewMetric({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/[0.06] md:border-b-0 md:pb-0">
      <span>{label}</span>
      <strong className="font-mono font-semibold text-slate-900 dark:text-white">{value}</strong>
    </div>
  )
}

function toggleSetValue(set, value) {
  const next = new Set(set)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  return next
}

function applyFeedbackState(feedbackItems, items, setters) {
  const likedIds = []
  const savedIds = []
  const mutedIds = []

  for (const item of items) {
    const feedback = feedbackItems.find((entry) => feedbackMatchesItem(entry, item))
    if (feedback?.liked) likedIds.push(item.id)
    if (feedback?.saved) savedIds.push(item.id)
    if (feedback?.muted) mutedIds.push(item.id)
  }

  setters.setLiked(new Set(likedIds))
  setters.setSaved(new Set(savedIds))
  setters.setMuted(new Set(mutedIds))
}

async function persistFlowFeedback(item, state) {
  try {
    await fetch('/api/aihot/flow-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, ...state }),
    })
  } catch {
    // Local UI state remains useful even if persistence is temporarily unavailable.
  }
}

function feedbackMatchesItem(feedback, item) {
  if (feedback.itemId && feedback.itemId === item.id) return true
  if (feedback.url && feedback.url === item.url) return true
  return Boolean(feedback.title && feedback.title === item.title)
}

function normalizeFeedItem(item) {
  const source = item.externalSource || item.sourceName || 'AI HOT'
  const id = item.id || stableFallbackId(item.url || item.title)

  return {
    id,
    title: item.title || item.url,
    summary: item.summary || '暂无摘要',
    source,
    sourceKey: slugifySource(source),
    category: item.category || inferCategory(item, source),
    publishedAt: item.publishedAt || new Date().toISOString(),
    heat: Number(item.score) || 45 + Math.round(pseudoRandom(`${id}-heat`) * 38),
    url: item.url,
  }
}

function withinWindow(value, windowKey, latest) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return true
  const hours = {
    '1h': 1,
    '6h': 6,
    '24h': 24,
    '7d': 24 * 7,
  }[windowKey]
  return latest.getTime() - date.getTime() <= hours * 36e5
}

function pseudoRandom(input) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(Math.sin(hash) * 10000) % 1
}

function formatRelative(value, latestValue) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  const latest = latestValue ? new Date(latestValue) : new Date()
  const hours = Math.max(1, Math.round((latest.getTime() - date.getTime()) / 36e5))
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

function formatFeedStatus(status) {
  if (status.state === 'ready') return `AI HOT API · ${formatClock(status.fetchedAt)}`
  if (status.state === 'fallback') return 'AI HOT API · 备用数据'
  return 'AI HOT API · 同步中'
}

function formatClock(value) {
  if (!value) return '已同步'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '已同步'
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function inferCategory(item, source) {
  const text = `${item.title || ''} ${item.summary || ''} ${source}`.toLowerCase()
  if (text.includes('论文') || text.includes('paper') || text.includes('arxiv')) return '论文'
  if (text.includes('agent') || text.includes('智能体') || text.includes('workflow')) return 'Agent'
  if (text.includes('模型') || text.includes('llm') || text.includes('gpt') || text.includes('claude')) return '模型'
  if (text.includes('产品') || text.includes('发布') || text.includes('app')) return '产品'
  return '动态'
}

function slugifySource(value) {
  return String(value || 'aihot')
    .toLowerCase()
    .replace(/[@()：:（），,。]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

function stableFallbackId(value) {
  return `rss-${slugifySource(value).slice(0, 36) || 'item'}`
}
