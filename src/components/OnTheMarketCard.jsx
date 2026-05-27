import { Link } from 'react-router-dom'
import {
  daysOnMarket,
  TOUCHPOINT_LABELS,
  formatAusDate,
  nextTouchpointAfter,
} from '../lib/format'

export default function OnTheMarketCard({ listing }) {
  const dom = daysOnMarket(listing.list_date)
  const sent = (listing.touchpoints ?? [])
    .filter((t) => t.sent_at)
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))
  const last = sent[0]
  const nextDue = nextTouchpointAfter(last?.type)

  return (
    <div className="bg-white border border-cream-200 rounded-lg shadow-sm hover:border-gold-500/50 transition">
      <div className="grid grid-cols-12 md:divide-x divide-cream-200">

        <Link
          to={`/listings/${listing.id}`}
          className="col-span-12 md:col-span-5 px-4 py-2.5 min-w-0 hover:text-gold-600 transition"
        >
          <h3 className="text-sm font-semibold text-navy-900 leading-tight truncate">
            {listing.address}
          </h3>
          <p className="text-xs text-navy-900/60 mt-0.5 truncate">
            {(listing.vendor_names ?? []).join(' & ') || 'No vendor names'}
          </p>
        </Link>

        <Stat label="Days on market">
          <span className="font-medium tabular-nums">{dom}d</span>
        </Stat>

        <Stat label="Last touchpoint" wide>
          {last ? (
            <>
              {TOUCHPOINT_LABELS[last.type]}
              <span className="text-navy-900/40 text-[11px] ml-1">
                · {formatAusDate(last.sent_at)}
              </span>
            </>
          ) : (
            <span className="text-navy-900/40 italic text-[11px]">None yet</span>
          )}
        </Stat>

        <Stat label="Next due">
          <span className="text-gold-600 font-medium">
            {TOUCHPOINT_LABELS[nextDue]}
          </span>
        </Stat>

      </div>
    </div>
  )
}

function Stat({ label, wide, children }) {
  const cols = wide ? 'col-span-4 md:col-span-3' : 'col-span-4 md:col-span-2'
  return (
    <div className={`${cols} px-4 py-2.5 min-w-0`}>
      <div className="text-[10px] uppercase tracking-wider text-navy-900/50">{label}</div>
      <div className="text-xs text-navy-900 mt-0.5 truncate">{children}</div>
    </div>
  )
}
