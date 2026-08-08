import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

export default function SourceHealth({ sourceHealth, sourcesChecked, items }) {
  const [expanded, setExpanded] = useState(false)

  if (!sourceHealth) return null

  const rawEntries = Object.entries(sourceHealth)
  if (rawEntries.length === 0) return null

  // Build name map from sourcesChecked
  const nameMap = {}
  if (sourcesChecked) {
    sourcesChecked.forEach(s => {
      nameMap[s.id] = s.name
    })
  }

  // Count actual displayed items per sourceId
  const actualCounts = {}
  if (items) {
    items.forEach(item => {
      const sid = item.sourceId || ''
      actualCounts[sid] = (actualCounts[sid] || 0) + 1
    })
  }

  // Merge sources that share the same creator key
  // e.g. wechat-khazix + aihot-khazix → one "khazix" row
  const platformPrefixes = ['wechat-', 'aihot-', 'bilibili-', 'xhs-']
  function creatorKey(id) {
    for (const p of platformPrefixes) {
      if (id.startsWith(p) && id !== p.slice(0, -1)) {
        return id.slice(p.length)
      }
    }
    return id // no prefix match → use full id as key
  }

  const groups = {}
  rawEntries.forEach(([sourceId, health]) => {
    const key = creatorKey(sourceId)
    if (!groups[key]) {
      groups[key] = { ids: [], ok: false, itemCount: 0 }
    }
    groups[key].ids.push(sourceId)
    if (health.ok) groups[key].ok = true
    groups[key].itemCount += (actualCounts[sourceId] || 0)
  })

  // Pick display name: prefer non-aihot source name
  const entries = Object.values(groups).map(g => {
    const primaryId = g.ids.find(id => !id.startsWith('aihot-')) || g.ids[0]
    return {
      sourceId: primaryId,
      name: nameMap[primaryId] || primaryId,
      ok: g.ok,
      itemCount: g.itemCount,
    }
  })

  const healthyCount = entries.filter(e => e.ok).length
  const totalCount = entries.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="mb-6"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500 transition-colors duration-500">
          数据源状态
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 transition-colors duration-500">
            {healthyCount}/{totalCount}
          </span>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-colors duration-500" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-1.5">
              {entries.map((entry, idx) => (
                <motion.div
                  key={entry.sourceId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className="flex items-center gap-2.5 py-1"
                >
                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    entry.ok
                      ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                      : 'bg-red-500 dark:bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.4)]'
                  }`} />

                  {/* Source name */}
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1 transition-colors duration-500">
                    {entry.name}
                  </span>

                  {/* Item count */}
                  <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 flex-shrink-0 transition-colors duration-500">
                    {entry.itemCount}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
