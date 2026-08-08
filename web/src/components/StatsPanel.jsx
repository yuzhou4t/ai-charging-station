import { motion } from 'framer-motion'

export default function StatsPanel({ items, sourceHealth, sourcesChecked }) {
  if (!items || !sourceHealth) return null

  const totalItems = items.length
  const totalSources = sourcesChecked?.length || Object.keys(sourceHealth).length
  const healthyCount = Object.values(sourceHealth).filter(s => s.ok).length
  const healthRate = totalSources > 0 ? Math.round((healthyCount / totalSources) * 100) : 0

  // Count by group
  const groupCounts = {}
  items.forEach(item => {
    const g = item.group || 'other'
    groupCounts[g] = (groupCounts[g] || 0) + 1
  })

  const groupLabels = {
    creator: '创作者',
    official: '官方',
    aihot: 'AI HOT',
    other: '其他',
  }

  const groupColors = {
    creator: 'bg-violet-500 dark:bg-violet-400',
    official: 'bg-emerald-500 dark:bg-emerald-400',
    aihot: 'bg-amber-500 dark:bg-amber-400',
    other: 'bg-slate-400 dark:bg-slate-500',
  }

  // SVG ring
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (healthRate / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="mb-6"
    >
      <h3 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500 mb-4 transition-colors duration-500">
        今日概况
      </h3>

      <div className="flex items-center gap-5">
        {/* Ring Chart */}
        <div className="relative flex-shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle
              cx="36" cy="36" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              className="text-slate-200 dark:text-white/[0.06] transition-colors duration-500"
            />
            <motion.circle
              cx="36" cy="36" r={radius}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              className="text-emerald-500 dark:text-emerald-400"
              stroke="currentColor"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums transition-colors duration-500">
              {healthRate}%
            </span>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-none transition-colors duration-500">
              {totalItems}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 transition-colors duration-500">条内容</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-700 dark:text-slate-200 tabular-nums leading-none transition-colors duration-500">
              {totalSources}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 transition-colors duration-500">个数据源</div>
          </div>
        </div>
      </div>

      {/* Group breakdown bar */}
      <div className="mt-4">
        <div className="flex rounded-full overflow-hidden h-1.5 bg-slate-200/60 dark:bg-white/[0.04] transition-colors duration-500">
          {Object.entries(groupCounts).map(([group, count]) => {
            const pct = (count / totalItems) * 100
            return (
              <motion.div
                key={group}
                className={`${groupColors[group] || groupColors.other} transition-colors duration-500`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.8, duration: 0.6, ease: 'easeOut' }}
              />
            )
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {Object.entries(groupCounts).map(([group, count]) => (
            <div key={group} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 transition-colors duration-500">
              <span className={`w-2 h-2 rounded-full ${groupColors[group] || groupColors.other} transition-colors duration-500`} />
              {groupLabels[group] || group} {count}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
