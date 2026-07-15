import { useEffect, useState } from 'react'
import { listVaultListings, addVaultListingsAsTracked, getLatestVaultSync } from '../lib/vault'
import Card from '../components/Card'

// Phase V5 — "Add from Vault" screen.
// Lists synced VaultRE properties and lets the user track the ones they choose
// (select-all included, so tracking everything is one click). Already-tracked
// listings are shown as such and cannot be added twice.
export default function VaultPicker() {
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [latestSync, setLatestSync] = useState(null)
  const [syncStatusError, setSyncStatusError] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    setSyncStatusError(false)
    try {
      const [nextRows, syncResult] = await Promise.all([
        listVaultListings(),
        getLatestVaultSync().catch(() => {
          setSyncStatusError(true)
          return null
        }),
      ])
      setRows(nextRows)
      setLatestSync(syncResult)
      setSelected(new Set())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const selectable = rows.filter((r) => !r.tracked)
  const allSelected =
    selectable.length > 0 && selectable.every((r) => selected.has(r.vault_listing_id))

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.vault_listing_id)))

  const add = async () => {
    const chosen = rows.filter((r) => selected.has(r.vault_listing_id))
    if (chosen.length === 0) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { added } = await addVaultListingsAsTracked(chosen)
      setNotice(`Added ${added} ${added === 1 ? 'listing' : 'listings'} to your tracked listings.`)
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const trackedCount = rows.length - selectable.length

  return (
    <div className="max-w-5xl space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Add from Vault</h1>
          <p className="text-sm text-navy-900/60 mt-1">
            {loading
              ? 'Loading your VaultRE listings...'
              : `${rows.length} synced from VaultRE. ${trackedCount} already tracked.`}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading || busy}
          className="text-sm px-3 py-1.5 rounded-md border border-cream-200 text-navy-900 hover:border-gold-500/40 hover:text-gold-600 disabled:opacity-50"
        >
          Refresh
        </button>
      </header>

      <SyncStatus sync={latestSync} unavailable={syncStatusError} loading={loading} />

      {notice && (
        <div className="rounded-md border border-gold-500/40 bg-gold-400/10 p-3">
          <p className="text-sm text-navy-900">{notice}</p>
        </div>
      )}
      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3">
          <p className="text-sm text-rose-700 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      <Card>
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-navy-900/50 italic">
            No Vault listings synced yet. Once the VaultRE sync has run, your active listings
            will appear here ready to track.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 pb-3 mb-2 border-b border-cream-200">
              <label className="inline-flex items-center gap-2 text-sm text-navy-900/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectable.length === 0 || busy}
                />
                Select all not yet tracked ({selectable.length})
              </label>
              <button
                type="button"
                onClick={add}
                disabled={selected.size === 0 || busy}
                className="text-sm px-4 py-2 rounded-md bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Adding...' : `Add ${selected.size} selected`}
              </button>
            </div>

            <ul className="divide-y divide-cream-200">
              {rows.map((r) => (
                <li
                  key={r.vault_listing_id}
                  className="flex items-center gap-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.vault_listing_id)}
                    onChange={() => toggle(r.vault_listing_id)}
                    disabled={r.tracked || busy}
                    aria-label={`Select ${r.address}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-navy-900 truncate">{r.address}</div>
                    <div className="text-xs text-navy-900/50">
                      {[r.suburb, r.state, r.postcode].filter(Boolean).join(' ')}
                      {r.list_price_display ? ` · ${r.list_price_display}` : ''}
                      {r.status ? ` · ${r.status}` : ''}
                    </div>
                  </div>
                  {r.tracked ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cream-100 text-navy-900/60 shrink-0">
                      Tracked
                    </span>
                  ) : r.vault_url ? (
                    <a
                      href={r.vault_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-navy-900/50 hover:text-gold-600 shrink-0"
                    >
                      View in Vault
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}

function SyncStatus({ sync, unavailable, loading }) {
  if (loading) return null

  if (unavailable) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Vault listings loaded, but sync status is temporarily unavailable.
      </div>
    )
  }

  if (!sync) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Vault has not completed its first sync yet.
      </div>
    )
  }

  const timestamp = sync.finished_at || sync.started_at
  const ageMs = Date.now() - new Date(timestamp).getTime()
  const stale = ageMs > 2 * 60 * 60 * 1000
  const failed = sync.status === 'failure' || sync.status === 'partial'
  const running = sync.status === 'running'
  const tone = failed || stale
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : running
      ? 'border-blue-200 bg-blue-50 text-blue-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900'

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${tone}`}>
      <span>
        {running ? 'Vault sync is running' : failed ? 'Latest Vault sync needs attention' : 'Vault is up to date'}
        {!running && ` · ${new Date(timestamp).toLocaleString('en-AU', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })}`}
      </span>
      {!running && sync.listings_pulled != null && (
        <span className="text-xs opacity-70">{sync.listings_pulled} listings checked</span>
      )}
      {stale && !failed && !running && (
        <span className="w-full text-xs font-medium">Data is more than two hours old.</span>
      )}
    </div>
  )
}
