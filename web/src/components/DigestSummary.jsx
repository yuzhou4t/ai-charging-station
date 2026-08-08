export default function DigestSummary({ notes }) {
  if (!notes || notes.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="text-xs font-sans tracking-widest font-semibold text-slate-400 dark:text-slate-500 uppercase mb-4 transition-colors duration-500">
        Editor's Note
      </h2>
      <ul className="space-y-4">
        {notes.map((note, idx) => (
          <li key={idx} className="text-slate-700 dark:text-slate-300 font-light leading-relaxed text-sm transition-colors duration-500">
            {note}
          </li>
        ))}
      </ul>
    </div>
  )
}
