import { Link } from 'react-router-dom'
import { formatAusDate, daysOnMarket, STAGE_LABELS } from '../lib/format'

export default function OffMarketCard({ listing }) {
  const daysSinceListed = daysOnMarket(listing.list_date)

  return (
    <div className="bg-white border border-cream-200 rounded-lg shadow-sm hover:border-gold-500/50 transition">
      <div className="grid grid-cols-12 md:divide-x divide-cream-200">

        <Link
          to={`/listings/${listing.id}`}
          className="col-span-12 md:col-span-6 px-4 py-2.5 min-w-0 hover:text-gold-600 transition"
        >
          <h3 className="text-sm font-semibold text-navy-900 leading-tight truncate">
            {listing.address}
          </h3>
          <p className="text-xs text-navy-900/60 mt-0.5 truncate">
            {(listing.vendor_names ?? []).join(' & ') || 'No vendor names'}
          </p>
        </Link>

        <div className="col-span-6 md:col-span-3 px-4 py-2.5 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-navy-900/50">Stage</div>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-cream-100 text-navy-900 font-medium">
              {STAGE_LABELS[listing.stage]}
            </span>
            {listing.is_tenanted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-900/5 text-navy-900/60">
                Tenanted
              </span>
            )}
          </div>
        </div>

        <div className="col-span-6 md:col-span-3 px-4 py-2.5 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-navy-900/50">Since listed</div>
          <div className="text-xs text-navy-900 mt-0.5 truncate">
            <span className="font-medium tabular-nums">{daysSinceListed}d</span>
            <span className="text-navy-900/40 ml-1">· {formatAusDate(listing.list_date)}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
