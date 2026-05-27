import { Link } from 'react-router-dom'
import { formatAusDate, formatCurrency } from '../lib/format'

export default function ArchivedCard({ listing }) {
  const settled = listing.contracts?.find((c) => c.is_active) ?? listing.contracts?.[0]

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="flex items-center justify-between bg-white border border-cream-200 rounded-md px-4 py-2 text-xs hover:bg-cream-50 hover:border-gold-500/40 transition"
    >
      <div className="flex items-center gap-4 min-w-0">
        <span className="font-medium text-navy-900/80 truncate">
          {listing.address}
        </span>
        <span className="text-navy-900/50 truncate hidden md:inline">
          {(listing.vendor_names ?? []).join(' & ')}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-navy-900/50 whitespace-nowrap pl-4">
        {settled?.settlement_date && (
          <span>Settled {formatAusDate(settled.settlement_date)}</span>
        )}
        {settled?.purchase_price && (
          <span className="text-gold-600 font-medium tabular-nums">
            {formatCurrency(settled.purchase_price)}
          </span>
        )}
      </div>
    </Link>
  )
}
