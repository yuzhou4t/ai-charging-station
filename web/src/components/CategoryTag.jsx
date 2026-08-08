const categoryColors = {
  'tip': {
    bg: 'bg-sky-100/80 dark:bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200/60 dark:ring-sky-500/20',
  },
  '行业动态': {
    bg: 'bg-violet-100/80 dark:bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200/60 dark:ring-violet-500/20',
  },
  '产品发布': {
    bg: 'bg-emerald-100/80 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200/60 dark:ring-emerald-500/20',
  },
  '研究论文': {
    bg: 'bg-amber-100/80 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200/60 dark:ring-amber-500/20',
  },
  '开源项目': {
    bg: 'bg-teal-100/80 dark:bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-300',
    ring: 'ring-teal-200/60 dark:ring-teal-500/20',
  },
  '融资投资': {
    bg: 'bg-rose-100/80 dark:bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-200/60 dark:ring-rose-500/20',
  },
  '教程': {
    bg: 'bg-indigo-100/80 dark:bg-indigo-500/10',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-200/60 dark:ring-indigo-500/20',
  },
}

const defaultColor = {
  bg: 'bg-slate-100/80 dark:bg-white/[0.06]',
  text: 'text-slate-600 dark:text-slate-400',
  ring: 'ring-slate-200/60 dark:ring-white/[0.08]',
}

export default function CategoryTag({ category }) {
  if (!category) return null

  const color = categoryColors[category] || defaultColor

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide ring-1 transition-all duration-300 hover:scale-105 ${color.bg} ${color.text} ${color.ring}`}
    >
      {category}
    </span>
  )
}
