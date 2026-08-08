import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

export default function Header({ date, history, selectedDate, onSelectDate }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const currentIndex = history?.findIndex(e => e.date === selectedDate) ?? -1
  const canGoPrev = currentIndex < (history?.length ?? 0) - 1
  const canGoNext = currentIndex > 0

  const goToPrev = () => {
    if (canGoPrev && history) {
      onSelectDate(history[currentIndex + 1].date)
    }
  }
  const goToNext = () => {
    if (canGoNext && history) {
      onSelectDate(history[currentIndex - 1].date)
    }
  }

  const currentEntry = history?.[currentIndex]

  return (
    <header className="flex flex-col items-start w-full">
      {/* Gradient Title */}
      <h1 className="text-4xl lg:text-5xl font-serif font-bold leading-tight mb-8 tracking-tight">
        <span className="bg-gradient-to-r from-slate-800 via-slate-600 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent transition-all duration-700">
          AI Daily.
        </span>
      </h1>
      
      {/* Custom Date Picker */}
      <div className="w-full border-b border-slate-200 dark:border-white/[0.08] pb-6 transition-colors duration-500">
        <div className="flex items-center gap-1" ref={dropdownRef}>
          {/* Prev arrow */}
          <button
            onClick={goToPrev}
            disabled={!canGoPrev}
            className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
            aria-label="前一天"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Date display + dropdown trigger */}
          <div className="relative flex-1">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm font-mono font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-300"
            >
              <span className="flex-1 text-left">{selectedDate || date || 'Loading...'}</span>
              {currentEntry && (
                <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 transition-colors duration-500">
                  {currentEntry.totalItems} 条
                </span>
              )}
              <motion.div
                animate={{ rotate: dropdownOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              </motion.div>
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
              {dropdownOpen && history && history.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute top-full left-0 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white/95 dark:bg-[#111113]/95 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-black/60 z-50 custom-scrollbar"
                >
                  <div className="py-1.5">
                    {history.map(entry => (
                      <button
                        key={entry.date}
                        onClick={() => {
                          onSelectDate(entry.date)
                          setDropdownOpen(false)
                        }}
                        className={`flex items-center justify-between w-full px-4 py-2.5 text-sm transition-all duration-200 ${
                          entry.date === selectedDate
                            ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="font-mono">{entry.date}</span>
                        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          {entry.totalItems} 条
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Next arrow */}
          <button
            onClick={goToNext}
            disabled={!canGoNext}
            className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
            aria-label="后一天"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
