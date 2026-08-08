import NewsCard from './NewsCard'
import SectionHeader from './SectionHeader'
import { feedbackItemKey } from '../aihotFeedback'

export default function NewsBoard({ items, sections, feedbackState = {}, onFeedback }) {
  // Use sections-based layout if sections are available
  if (sections) {
    const creatorUpdates = sections.creatorUpdates || []
    const officialUpdates = sections.officialUpdates || []
    const aihotPicks = sections.aihotPicks || []

    // Collect all IDs shown in sections to avoid duplicates
    const sectionIds = new Set([
      ...creatorUpdates.map(i => i.id),
      ...officialUpdates.map(i => i.id),
      ...aihotPicks.map(i => i.id),
    ])

    // Remaining items not in any section
    const remaining = (items || []).filter(i => !sectionIds.has(i.id))
    // Sort remaining: non-aihot first, then by score
    const sortedRemaining = [...remaining].sort((a, b) => {
      const isAAihot = (a.group === 'aihot' || a.sourceId === 'aihot') ? 1 : 0
      const isBAihot = (b.group === 'aihot' || b.sourceId === 'aihot') ? 1 : 0
      if (isAAihot !== isBAihot) return isAAihot - isBAihot
      return (b.score || 0) - (a.score || 0)
    })

    // Merge aihotPicks + remaining aihot
    const allAihot = [...aihotPicks]
    const aihotIds = new Set(aihotPicks.map(i => i.id))
    sortedRemaining.forEach(i => {
      if (!aihotIds.has(i.id)) {
        allAihot.push(i)
      }
    })

    const hasCreator = creatorUpdates.length > 0
    const hasOfficial = officialUpdates.length > 0
    const hasAihot = allAihot.length > 0

    return (
      <div className="pb-32 pt-4">
        {hasCreator && (
          <section>
            <SectionHeader sectionKey="creatorUpdates" count={creatorUpdates.length} />
            <div className="flex flex-col">
              {creatorUpdates.map((item, idx) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  variant="featured"
                  index={idx}
                  feedback={feedbackState[feedbackItemKey(item)]}
                  onFeedback={onFeedback}
                />
              ))}
            </div>
          </section>
        )}

        {hasOfficial && (
          <section>
            <SectionHeader sectionKey="officialUpdates" count={officialUpdates.length} />
            <div className="flex flex-col">
              {officialUpdates.map((item, idx) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  variant="standard"
                  index={idx}
                  feedback={feedbackState[feedbackItemKey(item)]}
                  onFeedback={onFeedback}
                />
              ))}
            </div>
          </section>
        )}

        {hasAihot && (
          <section>
            <SectionHeader sectionKey="aihotPicks" count={allAihot.length} />
            <div className="flex flex-col">
              {allAihot.map((item, idx) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  variant="compact"
                  index={idx}
                  feedback={feedbackState[feedbackItemKey(item)]}
                  onFeedback={onFeedback}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  // Fallback: flat list if no sections
  if (!items || !Array.isArray(items) || items.length === 0) return null

  const sortedItems = [...items].sort((a, b) => {
    const isAAihot = (a.group === 'aihot' || a.sourceId === 'aihot') ? 1 : 0
    const isBAihot = (b.group === 'aihot' || b.sourceId === 'aihot') ? 1 : 0
    if (isAAihot !== isBAihot) return isAAihot - isBAihot
    return (b.score || 0) - (a.score || 0)
  })

  return (
    <div className="pb-32 pt-4">
      <div className="flex flex-col transition-colors duration-500">
        {sortedItems.map((item, idx) => (
          <NewsCard
            key={item.id}
            item={item}
            index={idx}
            feedback={feedbackState[feedbackItemKey(item)]}
            onFeedback={onFeedback}
          />
        ))}
      </div>
    </div>
  )
}
