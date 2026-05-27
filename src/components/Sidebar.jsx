import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import NewListingModal from './NewListingModal'

export default function Sidebar({ counts, onRefresh }) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-navy-900 text-cream-100 flex flex-col">
      <div className="px-6 py-7 border-b border-navy-800">
        <div className="text-lg font-semibold tracking-tight">Listing Portal</div>
        <div className="text-xs text-cream-100/60 mt-0.5">Blac Property Group</div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center px-3 py-2 rounded-md text-sm transition ${
              isActive
                ? 'bg-navy-800 text-gold-400'
                : 'text-cream-100/80 hover:bg-navy-800/60'
            }`
          }
        >
          Dashboard
        </NavLink>

        <div className="pt-6 pb-2 px-3 text-[11px] uppercase tracking-wider text-cream-100/40">
          By stage
        </div>
        <CountRow label="Off Market"          value={counts.offMarket} />
        <CountRow label="On the Market"       value={counts.onTheMarket} />
        <CountRow label="Under Contract"      value={counts.underContract} accent />
        <CountRow label="Settled / Archived"  value={counts.archived} muted />
      </nav>

      <div className="px-3 py-4 border-t border-navy-800">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full px-3 py-2 rounded-md bg-gold-500 text-navy-950 text-sm font-medium hover:bg-gold-400 transition"
        >
          + New Listing
        </button>
      </div>

      <NewListingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false)
          onRefresh?.()
        }}
      />
    </aside>
  )
}

function CountRow({ label, value, accent, muted }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-sm">
      <span className={muted ? 'text-cream-100/40' : 'text-cream-100/80'}>{label}</span>
      <span
        className={`tabular-nums ${
          accent ? 'text-gold-400 font-medium' :
          muted  ? 'text-cream-100/40' :
                   'text-cream-100/80'
        }`}
      >
        {value == null ? '—' : value}
      </span>
    </div>
  )
}
