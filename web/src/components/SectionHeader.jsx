import { motion } from 'framer-motion'

const sectionConfig = {
  creatorUpdates: {
    icon: '👤',
    title: '创作者更新',
    accentClass: 'from-violet-500 to-fuchsia-500 dark:from-violet-400 dark:to-fuchsia-400',
    dotClass: 'bg-violet-500 dark:bg-violet-400',
  },
  officialUpdates: {
    icon: '🏢',
    title: '官方动态',
    accentClass: 'from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400',
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
  },
  aihotPicks: {
    icon: '🔥',
    title: 'AI HOT 精选',
    accentClass: 'from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-400',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
  },
}

export default function SectionHeader({ sectionKey, count }) {
  const config = sectionConfig[sectionKey] || {
    icon: '📰',
    title: sectionKey,
    accentClass: 'from-slate-500 to-slate-600',
    dotClass: 'bg-slate-500',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-4 pt-16 pb-6 first:pt-0"
    >
      {/* Decorative gradient bar */}
      <div className={`w-1 h-8 rounded-full bg-gradient-to-b ${config.accentClass} flex-shrink-0`} />

      <div className="flex items-center gap-3">
        <span className="text-xl" role="img" aria-label={config.title}>
          {config.icon}
        </span>
        <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400 transition-colors duration-500">
          {config.title}
        </h2>
      </div>

      {count > 0 && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 500, damping: 25 }}
          className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] text-[11px] font-medium text-slate-600 dark:text-slate-400 tabular-nums transition-colors duration-500"
        >
          {count}
        </motion.span>
      )}

      {/* Extending line */}
      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-white/[0.06] to-transparent transition-colors duration-500" />
    </motion.div>
  )
}
