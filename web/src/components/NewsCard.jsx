import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowUpRight, Languages, ThumbsDown, ThumbsUp } from 'lucide-react'
import { normalizeReadableTranslation } from '../../../src/translation.js'
import { isAiHotFeedbackItem } from '../aihotFeedback'
import CategoryTag from './CategoryTag'
import PlatformIcon from './PlatformIcon'

const variantStyles = {
  featured: {
    containerClass: 'py-8 lg:py-10 px-6 lg:px-8 border-l-[3px] border-l-violet-400/60 dark:border-l-violet-500/40',
    lightGradient: 'from-violet-50/40 via-transparent to-transparent',
    darkGradient: 'from-violet-950/20 via-transparent to-transparent',
    titleClass: 'text-2xl lg:text-3xl',
    summaryClass: 'text-base lg:text-lg',
    hoverScale: 1.015,
    hoverY: -8,
  },
  standard: {
    containerClass: 'py-8 lg:py-10 px-6 lg:px-8 border-l-[3px] border-l-emerald-400/60 dark:border-l-emerald-500/40',
    lightGradient: 'from-emerald-50/40 via-transparent to-transparent',
    darkGradient: 'from-emerald-950/20 via-transparent to-transparent',
    titleClass: 'text-xl lg:text-2xl',
    summaryClass: 'text-base',
    hoverScale: 1.01,
    hoverY: -6,
  },
  compact: {
    containerClass: 'py-5 lg:py-6 px-6 lg:px-8 border-l-[3px] border-l-amber-400/60 dark:border-l-amber-500/40',
    lightGradient: 'from-amber-50/30 via-transparent to-transparent',
    darkGradient: 'from-amber-950/15 via-transparent to-transparent',
    titleClass: 'text-lg lg:text-xl',
    summaryClass: 'text-sm lg:text-base',
    hoverScale: 1.005,
    hoverY: -4,
  },
}

export default function NewsCard({ item, feedback, onFeedback, variant = 'standard' }) {
  const ref = useRef(null)
  const [pendingRating, setPendingRating] = useState('')
  const displayCopy = getDisplayCopy(item)
  const sidePanel = getSidePanel(item, displayCopy)
  const activeRating = feedback?.rating || pendingRating
  const canGiveFeedback = isAiHotFeedbackItem(item) && onFeedback
  const styles = variantStyles[variant] || variantStyles.standard

  // Motion values for raw mouse position
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Smooth springs for rotation
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 })
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 })

  // Map mouse position to rotation range (-6deg to 6deg)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [6, -6])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-6, 6])

  const handleMouseMove = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const xPct = mouseX / width - 0.5
    const yPct = mouseY / height - 0.5
    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  const handleFeedback = async (rating) => {
    setPendingRating(rating)
    await onFeedback(item, rating)
  }

  return (
    <motion.article
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 60, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      whileHover={{ y: styles.hoverY, scale: styles.hoverScale }}
      whileTap={{ scale: 0.98 }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d"
      }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 20
      }}
      className={`block group relative ${styles.containerClass} border-b border-slate-200/80 dark:border-white/[0.06] transition-[color,background-color,border-color,box-shadow] duration-500 hover:bg-white/60 dark:hover:bg-[#151518]/60 hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-black/60 bg-transparent rounded-xl overflow-hidden`}
    >
      {/* Smooth Opacity Gradients for Theme Toggle */}
      <div className={`absolute inset-0 pointer-events-none bg-gradient-to-r ${styles.lightGradient} opacity-100 dark:opacity-0 transition-opacity duration-500`} />
      <div className={`absolute inset-0 pointer-events-none bg-gradient-to-r ${styles.darkGradient} opacity-0 dark:opacity-100 transition-opacity duration-500`} />

      <div className="relative z-10">
        {canGiveFeedback && (
          <div className="absolute right-0 top-0 lg:right-6 lg:top-0 z-20 flex items-center gap-1.5 rounded-full border border-slate-200/80 dark:border-white/[0.08] bg-white/65 dark:bg-[#111113]/75 p-1 shadow-sm backdrop-blur transition-colors duration-500">
            <FeedbackButton
              active={activeRating === 'good'}
              icon={<ThumbsUp className="w-3.5 h-3.5" />}
              label="标记不错"
              onClick={() => handleFeedback('good')}
            />
            <FeedbackButton
              active={activeRating === 'down'}
              icon={<ThumbsDown className="w-3.5 h-3.5" />}
              label="降低权重"
              onClick={() => handleFeedback('down')}
            />
          </div>
        )}

        <a
          href={item.url || undefined}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <div className="flex justify-between items-start mb-3" style={{ transform: "translateZ(20px)" }}>
            <div className="flex items-center gap-2.5 text-xs tracking-wider text-slate-500 font-medium transition-colors duration-500">
              <PlatformIcon platform={item.platform} className="w-3.5 h-3.5" />
              <span className="uppercase">{item.sourceName}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 transition-colors duration-500"></span>
              <span>{formatDate(item.publishedAt)}</span>
              {item.category && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 transition-colors duration-500"></span>
                  <CategoryTag category={item.category} />
                </>
              )}
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
          </div>

          <div
            className={sidePanel ? 'grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.85fr)]' : ''}
            style={{ transform: "translateZ(30px)" }}
          >
            <div>
              <h3 className={`${styles.titleClass} font-serif text-slate-800 dark:text-slate-100 mb-4 leading-snug group-hover:text-sky-600 dark:group-hover:text-white transition-colors duration-500`}>
                {displayCopy.title}
              </h3>

              <p className={`${styles.summaryClass} text-slate-600 dark:text-slate-400 leading-relaxed font-light transition-colors duration-500`}>
                {displayCopy.summary}
              </p>

              {/* External source badge for compact variant */}
              {variant === 'compact' && item.externalSource && (
                <div className="mt-3 text-xs text-slate-400 dark:text-slate-500 transition-colors duration-500">
                  via {item.externalSource}
                </div>
              )}
            </div>

            {sidePanel && (
              <aside className="rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-white/35 dark:bg-white/[0.03] p-4 lg:p-5 self-start transition-colors duration-500 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-slate-400 mb-3">
                  <Languages className="w-4 h-4" />
                  <span>{sidePanel.label}</span>
                </div>
                {sidePanel.title && (
                  <p className="text-base font-serif leading-snug text-slate-800 dark:text-slate-100 mb-3 transition-colors duration-500">
                    {sidePanel.title}
                  </p>
                )}
                {sidePanel.summary && (
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 transition-colors duration-500">
                    {sidePanel.summary}
                  </p>
                )}
              </aside>
            )}
          </div>
        </a>
      </div>
    </motion.article>
  )
}

function FeedbackButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-full transition-colors duration-200 ${
        active
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white'
      }`}
    >
      {icon}
    </button>
  )
}

function getDisplayCopy(item) {
  const translation = normalizeReadableTranslation(item.translation)
  const translationTitle = cleanText(translation?.title)
  const translationSummary = cleanText(translation?.summary)
  const currentTitle = cleanText(item.title)
  const currentSummary = cleanText(item.summary)
  const usedTranslation = Boolean(
    (translationTitle && translationTitle !== currentTitle) ||
    (translationSummary && translationSummary !== currentSummary)
  )

  return {
    title: translationTitle || currentTitle,
    summary: translationSummary || currentSummary,
    originalTitle: currentTitle,
    originalSummary: currentSummary,
    usedTranslation,
  }
}

function getSidePanel(item, displayCopy) {
  const originalTitle = cleanText(item.originalTitle) || (displayCopy.usedTranslation ? displayCopy.originalTitle : '')
  const originalSummary = cleanText(item.originalSummary) || (displayCopy.usedTranslation ? displayCopy.originalSummary : '')
  const currentTitle = cleanText(displayCopy.title)
  const currentSummary = cleanText(displayCopy.summary)

  if ((originalTitle && originalTitle !== currentTitle) || (originalSummary && originalSummary !== currentSummary)) {
    return {
      label: '原文',
      title: originalTitle !== currentTitle ? originalTitle : '',
      summary: originalSummary !== currentSummary ? originalSummary : '',
    }
  }

  return null
}

function formatDate(value) {
  if (!value) return '未标注日期'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未标注日期' : date.toLocaleDateString()
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}
