import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import NewListingModal from './NewListingModal'
import ProfileMenu from './auth/ProfileMenu'
import AdminBadge from './admin/AdminBadge'

export default function Sidebar({ counts, onRefresh }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const openNewListing = () => {
    setMenuOpen(false)
    setModalOpen(true)
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-navy-800 bg-navy-900 px-4 text-cream-100 md:hidden">
        <div>
          <div className="font-semibold leading-tight">Listing Portal</div>
          <div className="mt-0.5 text-[11px] text-cream-100/60">Blac Property Group</div>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-cream-100/20 text-xl"
          aria-label="Open navigation"
          aria-expanded={menuOpen}
        >
          ☰
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-navy-950/60 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col bg-navy-900 text-cream-100 transition-transform duration-200 md:z-20 md:w-60 md:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-md text-2xl text-cream-100/70 md:hidden"
          aria-label="Close navigation"
        >
          ×
        </button>
        <div className="border-b border-navy-800 px-6 py-7">
          <div className="text-lg font-semibold tracking-tight">Listing Portal</div>
          <div className="mt-0.5 text-xs text-cream-100/60">Blac Property Group</div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavLink
          to="/"
          end
          onClick={() => setMenuOpen(false)}
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

        <NavLink
          to="/vault"
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center px-3 py-2 mt-1 rounded-md text-sm transition ${
              isActive
                ? 'bg-navy-800 text-gold-400'
                : 'text-cream-100/80 hover:bg-navy-800/60'
            }`
          }
        >
          Add from Vault
        </NavLink>

        <div className="pt-6 pb-2 px-3 text-[11px] uppercase tracking-wider text-cream-100/40">
          By stage
        </div>
        <CountRow label="Off Market"          value={counts.offMarket} />
        <CountRow label="On the Market"       value={counts.onTheMarket} />
        <CountRow label="Under Contract"      value={counts.underContract} accent />
        <CountRow label="Settled / Archived"  value={counts.archived} muted />
        </nav>

        <div className="border-t border-navy-800 px-3 py-4">
        <button
          type="button"
          onClick={openNewListing}
          className="min-h-11 w-full rounded-md bg-gold-500 px-3 py-2 text-sm font-medium text-navy-950 transition hover:bg-gold-400"
        >
          + New Listing
        </button>
        </div>

        <AdminBadge />
        <ProfileMenu />

        <NewListingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false)
            onRefresh?.()
          }}
        />
      </aside>
    </>
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
