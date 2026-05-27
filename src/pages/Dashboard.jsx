import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import NeedsAttention from '../components/NeedsAttention'
import TodayTasks from '../components/TodayTasks'
import OffMarketCard from '../components/OffMarketCard'
import OnTheMarketCard from '../components/OnTheMarketCard'
import UnderContractCard from '../components/UnderContractCard'
import ArchivedCard from '../components/ArchivedCard'
import { daysOnMarket } from '../lib/format'

const SORT_OPTIONS = [
  { value: 'default',      label: 'Sort: Newest first' },
  { value: 'address_asc',  label: 'Sort: Address A–Z' },
  { value: 'dom_desc',     label: 'Sort: DOM (highest)' },
  { value: 'dom_asc',      label: 'Sort: DOM (lowest)' },
]

export default function Dashboard() {
  const { listings, loading, error, refetch } = useOutletContext()
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('default')

  if (loading) {
    return (
      <div className="max-w-6xl">
        <h1 className="text-2xl font-semibold text-navy-900">Dashboard</h1>
        <p className="text-sm text-navy-900/60 mt-1">Loading listings…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-navy-900">Dashboard</h1>
        <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 p-4">
          <h2 className="text-sm font-semibold text-rose-800">Couldn't load listings</h2>
          <p className="mt-1 text-sm text-rose-700 whitespace-pre-wrap">{error.message}</p>
          <button
            onClick={refetch}
            className="mt-3 text-sm px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Inline (not useMemo) — useMemo after the early returns above would violate
  // the rules of hooks. The work is cheap enough to recompute each render.
  const filterAndSort = (arr) => {
    let result = arr
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((l) =>
        l.address.toLowerCase().includes(q) ||
        (l.vendor_names ?? []).some((n) => n.toLowerCase().includes(q))
      )
    }
    if (sortBy === 'address_asc') {
      result = [...result].sort((a, b) => a.address.localeCompare(b.address))
    } else if (sortBy === 'dom_desc') {
      result = [...result].sort((a, b) => daysOnMarket(b.list_date) - daysOnMarket(a.list_date))
    } else if (sortBy === 'dom_asc') {
      result = [...result].sort((a, b) => daysOnMarket(a.list_date) - daysOnMarket(b.list_date))
    }
    return result
  }

  const offMarket    = filterAndSort(listings.filter((l) => ['listed', 'photos_taken', 'tenants_contacted'].includes(l.stage)))
  const onTheMarket  = filterAndSort(listings.filter((l) => l.stage === 'launched_online'))
  const underContract = filterAndSort(listings.filter((l) => l.stage === 'under_contract'))
  const archived     = filterAndSort(listings.filter((l) => ['settlement', 'archived'].includes(l.stage)))

  const filtering = searchQuery.length > 0

  if (listings.length === 0) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-navy-900">Dashboard</h1>
        <div className="mt-6 rounded-lg border border-cream-200 bg-white p-6">
          <h2 className="font-semibold text-navy-900">No listings yet</h2>
          <p className="text-sm text-navy-900/70 mt-2">
            Click <strong>+ New Listing</strong> in the sidebar to add your first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Dashboard</h1>
          <p className="text-sm text-navy-900/60 mt-1">
            {listings.length} {listings.length === 1 ? 'listing' : 'listings'} across all stages
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address or vendor…"
            className="input w-64 text-sm"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input bg-white text-sm w-48"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={refetch}
            className="text-xs px-3 py-1.5 rounded-md border border-cream-200 bg-white text-navy-900/70 hover:border-gold-500/40 hover:text-navy-900"
          >
            Refresh
          </button>
        </div>
      </header>

      <NeedsAttention listings={listings} />
      <TodayTasks listings={listings} onUpdate={refetch} />

      <Section title="Off Market" count={offMarket.length}>
        {offMarket.length === 0 ? (
          <Empty filtering={filtering}>No listings off market.</Empty>
        ) : (
          <div className="space-y-2">
            {offMarket.map((l) => (
              <OffMarketCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </Section>

      <Section title="On the Market" count={onTheMarket.length}>
        {onTheMarket.length === 0 ? (
          <Empty filtering={filtering}>No listings on the market.</Empty>
        ) : (
          <div className="space-y-2">
            {onTheMarket.map((l) => (
              <OnTheMarketCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Under Contract" count={underContract.length} accent>
        {underContract.length === 0 ? (
          <Empty filtering={filtering}>No listings under contract.</Empty>
        ) : (
          <div className="space-y-2">
            {underContract.map((l) => (
              <UnderContractCard key={l.id} listing={l} onUpdate={refetch} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Settled / Archived"
        count={archived.length}
        muted
        collapsible
        collapsed={!showArchived}
        onToggle={() => setShowArchived((s) => !s)}
      >
        {showArchived &&
          (archived.length === 0 ? (
            <Empty filtering={filtering}>No settled listings yet.</Empty>
          ) : (
            <div className="space-y-1.5">
              {archived.map((l) => (
                <ArchivedCard key={l.id} listing={l} />
              ))}
            </div>
          ))}
      </Section>
    </div>
  )
}

function Section({ title, count, accent, muted, collapsible, collapsed, onToggle, children }) {
  return (
    <section>
      <div
        className={`flex items-center gap-3 mb-3 ${
          collapsible ? 'cursor-pointer select-none' : ''
        }`}
        onClick={collapsible ? onToggle : undefined}
      >
        {collapsible && (
          <span className="text-navy-900/40 text-xs w-3">
            {collapsed ? '▶' : '▼'}
          </span>
        )}
        <h2
          className={`text-lg font-semibold ${
            muted ? 'text-navy-900/60' : 'text-navy-900'
          }`}
        >
          {title}
        </h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${
            accent
              ? 'bg-gold-500/15 text-gold-600 font-medium'
              : muted
              ? 'bg-navy-900/5 text-navy-900/50'
              : 'bg-navy-900/10 text-navy-900/70'
          }`}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  )
}

function Empty({ filtering, children }) {
  return (
    <p className="text-sm text-navy-900/40 py-2 italic">
      {filtering ? 'No listings match your search.' : children}
    </p>
  )
}
