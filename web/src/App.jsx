import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Moon, Newspaper, Sun } from 'lucide-react'
import BackgroundMesh from './components/BackgroundMesh'
import Header from './components/Header'
import DigestSummary from './components/DigestSummary'
import StatsPanel from './components/StatsPanel'
import SourceHealth from './components/SourceHealth'
import NewsBoard from './components/NewsBoard'
import ScrollProgress from './components/ScrollProgress'
import AIHotFlowPreview from './components/AIHotFlowPreview'
import { buildFeedbackPayload, feedbackItemKey, readFeedbackState, updateFeedbackState, writeFeedbackState } from './aihotFeedback'

function App() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [aiHotFeedback, setAiHotFeedback] = useState(() => readFeedbackState())
  const [activeView, setActiveView] = useState('daily')
  // Default to light mode
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Sync dark mode state with html tag
  useEffect(() => {
    const root = window.document.documentElement
    if (isDarkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    async function initLoad() {
      try {
        const idxRes = await fetch('/data/digests/index.json')
        if (!idxRes.ok) throw new Error('Failed to fetch index.json (history)')
        const idxData = await idxRes.json()

        setHistory(idxData.entries || [])
        if (idxData.latestDate) {
          setSelectedDate(idxData.latestDate)
        }
      } catch (err) {
        console.error('History load error:', err)
        try {
          const latestRes = await fetch('/data/latest.json')
          const latest = await latestRes.json()
          setSelectedDate(latest.date)
        } catch {
          setError('Failed to initialize application.')
          setLoading(false)
        }
      }
    }
    initLoad()
  }, [])

  useEffect(() => {
    if (!selectedDate) return

    async function loadDigest() {
      setLoading(true)
      setError(null)
      try {
        const digestRes = await fetch(`/data/digests/${selectedDate}.json`)
        if (!digestRes.ok) throw new Error(`Failed to fetch digest for ${selectedDate}`)
        const digest = await digestRes.json()
        setData(digest)
      } catch (err) {
        console.error(err)
        setError(err.message)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    loadDigest()
  }, [selectedDate])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeView])

  const handleAiHotFeedback = async (item, rating) => {
    const next = updateFeedbackState(aiHotFeedback, item, rating)
    setAiHotFeedback(next)
    writeFeedbackState(next)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFeedbackPayload(item, rating)),
      })
      if (response.ok) {
        return
      }
    } catch {
      // API persistence is best-effort; local state is still recorded.
    }

    const command = next[feedbackItemKey(item)]?.command
    if (command && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(command)
      } catch {
        // Clipboard permission is best-effort; local state is still recorded.
      }
    }
  }

  return (
    <>
      <ScrollProgress />
      <BackgroundMesh />
      <div className="min-h-screen flex flex-col lg:flex-row relative">

        {/* Fixed Sidebar */}
        <aside className="w-full lg:w-[350px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/[0.08] z-40 bg-[#F3F3F0] dark:bg-[#0A0A0B] lg:bg-transparent dark:lg:bg-transparent h-auto lg:h-screen lg:sticky top-0 flex flex-col transition-colors duration-500">
          <div className="w-full lg:w-[350px] flex flex-col h-full max-h-[80vh] lg:max-h-full">
            {/* Scrollable Content Area */}
            <div className="flex-1 p-6 lg:p-8 overflow-y-auto custom-scrollbar relative z-0">
              <div className="flex justify-between items-start mb-8 pt-8 lg:pt-16">
                <Header
                  date={data?.date || selectedDate}
                  history={history}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </div>

              {/* Stats Panel */}
              {data && (
                <StatsPanel
                  items={data.items}
                  sourceHealth={data.sourceHealth}
                  sourcesChecked={data.sourcesChecked}
                />
              )}

              {/* Editor Notes */}
              {data && <DigestSummary notes={data.editorNotes} />}

              {/* Source Health */}
              {data && (
                <SourceHealth
                  sourceHealth={data.sourceHealth}
                  sourcesChecked={data.sourcesChecked}
                  items={data.items}
                />
              )}
            </div>

            {/* Fixed Theme Toggle Footer */}
            <div className="flex-shrink-0 p-6 lg:p-8 pt-6 pb-6 lg:pb-10 border-t border-slate-200/60 dark:border-white/[0.04] bg-[#F3F3F0]/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md transition-colors duration-500 relative z-10">
              <div
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="relative flex items-center p-1 bg-slate-200 dark:bg-[#111113] rounded-full cursor-pointer w-20 h-10 shadow-inner border border-slate-300 dark:border-slate-800 transition-colors duration-500"
                aria-label="Toggle theme"
              >
                {/* Sliding Background Handle */}
                <motion.div
                  className="absolute w-8 h-8 bg-white dark:bg-[#202024] rounded-full shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-500"
                  layout
                  initial={false}
                  animate={{ x: isDarkMode ? 40 : 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />

                <div className="relative z-10 flex w-full justify-between px-1.5 pointer-events-none">
                  <Sun className={`w-4 h-4 transition-colors duration-500 ${!isDarkMode ? 'text-amber-500' : 'text-slate-400 dark:text-slate-600'}`} />
                  <Moon className={`w-4 h-4 transition-colors duration-500 ${isDarkMode ? 'text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`} />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Timeline */}
        <main className={`min-w-0 flex-1 px-4 py-16 pt-12 sm:px-8 lg:mx-auto lg:px-16 lg:py-24 lg:pt-24 perspective-container relative z-10 ${activeView === 'flow' ? 'max-w-7xl xl:px-20' : 'max-w-4xl xl:px-32'}`}>
          <div className="mb-8 flex w-full justify-center lg:justify-start">
            <div className="inline-flex rounded-full border border-slate-200 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.04]">
              <ViewButton active={activeView === 'daily'} onClick={() => setActiveView('daily')} icon={<Newspaper className="h-4 w-4" />}>
                日报
              </ViewButton>
              <ViewButton active={activeView === 'flow'} onClick={() => setActiveView('flow')} icon={<Flame className="h-4 w-4" />}>
                AI HOT 流
              </ViewButton>
            </div>
          </div>

          {activeView === 'flow' && <AIHotFlowPreview />}

          {activeView === 'daily' && loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
                <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">Connecting to AI core...</p>
              </div>
            </div>
          )}

          {activeView === 'daily' && error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-6 rounded-2xl text-red-600 dark:text-red-400 mb-8 transition-colors duration-500">
              Error loading data: {error}
            </div>
          )}

          {activeView === 'daily' && !loading && data && (
            <div className="animate-in fade-in duration-500">
              <NewsBoard
                items={data.items}
                sections={data.sections}
                feedbackState={aiHotFeedback}
                onFeedback={handleAiHotFeedback}
              />
            </div>
          )}
        </main>
      </div>
    </>
  )
}

function ViewButton({ active, children, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

export default App
