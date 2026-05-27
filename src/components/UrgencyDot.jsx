// Traffic-light dot per brief:
//   green  > 7 days
//   amber  3–7 days
//   red    < 3 days (incl. today and overdue)
export default function UrgencyDot({ daysUntil }) {
  let color = 'bg-emerald-500'
  let label = 'On track'
  if (daysUntil < 3) {
    color = 'bg-rose-500'
    label = daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due today' : 'Urgent'
  } else if (daysUntil <= 7) {
    color = 'bg-amber-500'
    label = 'Due soon'
  }
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${color}`}
      title={label}
      aria-label={label}
    />
  )
}
