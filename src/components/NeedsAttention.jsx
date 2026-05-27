import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { daysOnMarket, daysUntil, formatAusDate } from '../lib/format'
import Card from './Card'

const RADIO_SILENCE_DAYS = 14
const STALE_LISTING_DAYS = 45
const PRE_LAUNCH_PHOTO_GRACE = 3
const LISTED_STUCK_DAYS = 7

export default function NeedsAttention({ listings }) {
  const flags = useMemo(() => buildFlags(listings), [listings])
  if (flags.length === 0) return null

  const redCount = flags.filter((f) => f.severity === 'red').length
  const amberCount = flags.filter((f) => f.severity === 'amber').length

  const headerRight = (
    <div className="flex items-center gap-1.5">
      {redCount > 0 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
          {redCount} urgent
        </span>
      )}
      {amberCount > 0 && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
          {amberCount} attention
        </span>
      )}
      <span className="text-xs px-2 py-0.5 rounded-full bg-cream-100 text-navy-900/70 font-medium tabular-nums">
        {flags.length}
      </span>
    </div>
  )

  return (
    <Card title="Needs attention" right={headerRight}>
      <ul className="space-y-2">
        {flags.map((f, i) => (
          <FlagRow key={i} flag={f} />
        ))}
      </ul>
    </Card>
  )
}

function FlagRow({ flag }) {
  const styles =
    flag.severity === 'red'   ? 'bg-rose-50 border-rose-200' :
    flag.severity === 'amber' ? 'bg-amber-50 border-amber-200' :
                                'bg-navy-900/5 border-cream-200'
  const dotColor =
    flag.severity === 'red'   ? 'bg-rose-600' :
    flag.severity === 'amber' ? 'bg-amber-500' :
                                'bg-navy-900/40'

  return (
    <li className={`flex items-start gap-3 p-3 rounded-md border ${styles}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0 mt-1.5`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-navy-900">
          {flag.message}
          <span className="text-navy-900/30 mx-2">·</span>
          <Link to={`/listings/${flag.listingId}`} className="text-navy-900/70 hover:text-gold-600">
            {flag.listingAddress}
          </Link>
        </div>
        <div className="text-xs text-navy-900/60 mt-0.5">{flag.detail}</div>
      </div>
    </li>
  )
}

// -----------------------------------------------------------------------------
// Flag derivation
// -----------------------------------------------------------------------------
function buildFlags(listings) {
  const flags = []

  for (const listing of listings) {
    const dom = daysOnMarket(listing.list_date)
    const services = listing.listing_services ?? []
    const touchpoints = listing.touchpoints ?? []
    const weeklyLogs = (listing.weekly_logs ?? [])
      .slice()
      .sort((a, b) => new Date(b.week_ending) - new Date(a.week_ending))
    const activeContract = listing.contracts?.find((c) => c.is_active)

    // -- 1. Stuck in Listed for over a week --
    if (listing.stage === 'listed' && dom > LISTED_STUCK_DAYS) {
      flags.push({
        severity: 'amber',
        message: 'Stuck in Listed',
        detail: `${dom} days since added, photos still not taken`,
        listingId: listing.id,
        listingAddress: listing.address,
      })
    }

    // -- 2. No photographer booked for an actively-pre-launch listing --
    //    Only flags `listed` stage. Once stage advances to `photos_taken`,
    //    we assume photos are done even if no Service was logged.
    if (listing.stage === 'listed' && dom > PRE_LAUNCH_PHOTO_GRACE) {
      const hasPhotographer = services.some((s) => s.service_type === 'photographer')
      if (!hasPhotographer) {
        flags.push({
          severity: 'amber',
          message: 'No photographer booked',
          detail: `${dom} days since listed, nothing in Services`,
          listingId: listing.id,
          listingAddress: listing.address,
        })
      }
    }

    // -- 3. Vendor radio silence on a live listing --
    if (listing.stage === 'launched_online') {
      const sentTps = touchpoints.filter((t) => t.sent_at)
      const lastSent = sentTps.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0]
      const daysSinceContact = lastSent
        ? Math.floor((Date.now() - new Date(lastSent.sent_at).getTime()) / (1000 * 60 * 60 * 24))
        : dom

      if (daysSinceContact > RADIO_SILENCE_DAYS) {
        flags.push({
          severity: 'amber',
          message: 'Vendor radio silence',
          detail: lastSent
            ? `${daysSinceContact} days since last touchpoint`
            : `${dom} days on market, no touchpoints sent yet`,
          listingId: listing.id,
          listingAddress: listing.address,
        })
      }
    }

    // -- 4. Settlement approaching --
    if (listing.stage === 'under_contract' && activeContract?.settlement_date) {
      const settleDays = daysUntil(activeContract.settlement_date)
      const settleDate = formatAusDate(activeContract.settlement_date)
      if (settleDays >= 0 && settleDays <= 3) {
        flags.push({
          severity: 'red',
          message: settleDays === 0 ? 'Settlement today' : 'Settlement imminent',
          detail: `${settleDate} · ${settleDays === 0 ? 'today' : `${settleDays}d to go`} · confirm conveyancer, schedule pre-settlement inspection`,
          listingId: listing.id,
          listingAddress: listing.address,
        })
      } else if (settleDays > 3 && settleDays <= 7) {
        flags.push({
          severity: 'amber',
          message: 'Settlement this week',
          detail: `${settleDate} · ${settleDays}d to go`,
          listingId: listing.id,
          listingAddress: listing.address,
        })
      }
    }

    // -- 5. Activity cooling (enquiries down 50%+ vs prior week) --
    if (listing.stage === 'launched_online' && weeklyLogs.length >= 2) {
      const latest = Number(weeklyLogs[0].enquiry_count) || 0
      const prior  = Number(weeklyLogs[1].enquiry_count) || 0
      if (prior >= 4 && latest * 2 <= prior) {
        const pctDrop = Math.round((1 - latest / prior) * 100)
        flags.push({
          severity: 'amber',
          message: 'Interest cooling',
          detail: `Enquiries: ${prior} → ${latest} (down ${pctDrop}%)`,
          listingId: listing.id,
          listingAddress: listing.address,
        })
      }
    }

    // -- 6. Stale listing (45+ days on market) --
    if (listing.stage === 'launched_online' && dom > STALE_LISTING_DAYS) {
      flags.push({
        severity: 'subtle',
        message: 'On market 45+ days',
        detail: `${dom} days, consider price discussion`,
        listingId: listing.id,
        listingAddress: listing.address,
      })
    }
  }

  // Red first, then amber, then subtle
  const order = { red: 0, amber: 1, subtle: 2 }
  flags.sort((a, b) => order[a.severity] - order[b.severity])

  return flags
}
