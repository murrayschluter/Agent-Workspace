export default function Card({ title, right, children, className = '' }) {
  return (
    <section className={`bg-white border border-cream-200 rounded-lg shadow-sm ${className}`}>
      {(title || right) && (
        <header className="px-6 py-4 border-b border-cream-200 flex items-center justify-between gap-4">
          {title && <h2 className="font-semibold text-navy-900">{title}</h2>}
          <div className="flex items-center gap-2">{right}</div>
        </header>
      )}
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}
