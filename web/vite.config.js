import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { recordItemFeedback } from '../src/feedback.js'
import { fetchAiHotFlowItems } from '../src/aihot-flow-fetch.js'
import { mergeAiHotFlowStore, readFlowFeedback, readFlowStore, recordFlowFeedback } from '../src/aihot-flow-store.js'
import { fetchRssSource } from '../src/fetchers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Custom plugin to serve ../data directory at /data
function serveDataPlugin() {
  return {
    name: 'serve-data-plugin',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        // req.url includes the query string, we should split it
        const urlPath = req.url.split('?')[0].slice(1);
        const filePath = path.resolve(__dirname, '../data', urlPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
          if (filePath.endsWith('.md')) res.setHeader('Content-Type', 'text/markdown');
          res.end(fs.readFileSync(filePath));
        } else {
          next();
        }
      });
    }
  }
}

function feedbackApiPlugin() {
  return {
    name: 'feedback-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/feedback', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const payload = await readJsonBody(req)
          const feedbackPath = process.env.AIHOT_FEEDBACK_PATH || path.resolve(__dirname, '../data/feedback/items.json')
          await recordItemFeedback(feedbackPath, payload)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
        }
      })
    }
  }
}

function aiHotRssApiPlugin() {
  let cache = null

  return {
    name: 'aihot-rss-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/aihot/rss', async (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }

        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const take = clampNumber(Number(url.searchParams.get('take') || 80), 1, 120)
          const now = Date.now()

          if (!cache || now - cache.fetchedAt > 10 * 60 * 1000) {
            const source = {
              id: 'aihot-rss',
              name: 'AI HOT',
              kind: 'rss',
              group: 'aihot',
              platform: 'rss',
              url: 'https://aihot.virxact.com/feed/all.xml',
              timeoutMs: 15_000,
            }
            const items = await fetchRssSource(source, source.url)
            cache = { fetchedAt: now, items }
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: true,
              fetchedAt: new Date(cache.fetchedAt).toISOString(),
              sourceUrl: 'https://aihot.virxact.com/feed/all.xml',
              items: cache.items.slice(0, take),
            })
          )
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
        }
      })
    }
  }
}

function aiHotItemsApiPlugin() {
  let cache = null
  let refreshPromise = null

  return {
    name: 'aihot-items-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/aihot/items', async (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }

        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const takeParam = url.searchParams.get('take') || 'all'
          const take = takeParam === 'all' ? null : clampNumber(Number(takeParam), 1, 5000)
          const now = Date.now()
          const forceRefresh = url.searchParams.get('refresh') === '1'
          const diskCache = await readStoredAiHotFlow(now)

          if (diskCache && (!cache || diskCache.fetchedAt > cache.fetchedAt)) {
            cache = diskCache
          }

          if (forceRefresh || !cache) {
            cache = await refreshAiHotFlow(now)
          } else if (now - cache.fetchedAt > 60 * 60 * 1000 && !refreshPromise) {
            refreshPromise = refreshAiHotFlow(now)
              .then((nextCache) => {
                cache = nextCache
              })
              .catch((error) => {
                console.error('AI HOT flow background refresh failed:', error)
              })
              .finally(() => {
                refreshPromise = null
              })
          }

          const responseItems = take ? cache.items.slice(0, take) : cache.items

          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: true,
              fetchedAt: new Date(cache.fetchedAt).toISOString(),
              now: new Date(now).toISOString(),
              cacheTtlSeconds: 3600,
              sourceUrl: 'https://aihot.virxact.com/api/public/items',
              total: cache.items.length,
              stats: cache.stats,
              sourceHealth: cache.sourceHealth,
              refreshing: Boolean(refreshPromise),
              cacheSource: cache.source,
              items: responseItems,
            })
          )
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
        }
      })
    }
  }
}

function aiHotFlowFeedbackApiPlugin() {
  return {
    name: 'aihot-flow-feedback-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/aihot/flow-feedback', async (req, res, next) => {
        if (req.method === 'GET') {
          try {
            const feedback = await readFlowFeedback(aiHotFlowFeedbackPath())
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, ...feedback }))
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
          }
          return
        }

        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const payload = await readJsonBody(req)
          const feedback = await recordFlowFeedback(aiHotFlowFeedbackPath(), payload)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, ...feedback }))
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
        }
      })
    }
  }
}

async function readStoredAiHotFlow(now) {
  const store = await readFlowStore(aiHotFlowStorePath())
  if (!store.items.length) {
    return null
  }

  const workflow = readFlowWorkflow()
  const fetchedAt = Date.parse(store.updatedAt || workflow?.finishedAt || '') || now
  return {
    fetchedAt,
    items: store.items,
    stats: store.stats,
    sourceHealth: workflow?.sourceHealth || {},
    source: 'disk',
  }
}

async function refreshAiHotFlow(now) {
  const flow = await fetchAiHotFlowItems({ now: new Date(now), includeHourlySources: true })
  const store = await mergeAiHotFlowStore({
    storePath: aiHotFlowStorePath(),
    incomingItems: flow.items,
    feedbackPath: aiHotFlowFeedbackPath(),
    digestDir: path.resolve(__dirname, '../data/digests'),
    now: new Date(now),
    retentionDays: 30,
  })
  return {
    fetchedAt: now,
    items: store.items,
    stats: store.stats,
    sourceHealth: flow.sourceHealth,
    source: 'network',
  }
}

function readFlowWorkflow() {
  const filePath = path.resolve(__dirname, '../data/flow/latest-workflow.json')
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function aiHotFlowStorePath() {
  return process.env.AIHOT_FLOW_STORE_PATH || path.resolve(__dirname, '../data/flow/aihot-items.json')
}

function aiHotFlowFeedbackPath() {
  return process.env.AIHOT_FLOW_FEEDBACK_PATH || path.resolve(__dirname, '../data/flow/feedback.json')
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(max, Math.max(min, value))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    serveDataPlugin(),
    feedbackApiPlugin(),
    aiHotRssApiPlugin(),
    aiHotItemsApiPlugin(),
    aiHotFlowFeedbackApiPlugin()
  ]
})
