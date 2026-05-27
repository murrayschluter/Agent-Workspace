import { useState } from 'react'
import { Link } from 'react-router-dom'
import UrgencyDot from './UrgencyDot'
import { updateContractConditions } from '../lib/contracts'
import {
  formatAusDate,
  daysUntil,
  addDaysToDateStr,
  todayDateStr,
  CONDITION_LABELS,
} from '../lib/format'

export default function UnderContractCard({ listing, onUpdate }) {
  const contract = listing.contracts?.find((c) => c.is_active)
  const conditions = Array.isArray(contract?.conditions) ? contract.conditions : []

  const [extendingIdx, setExtendingIdx] = useState(null)
  const [extendDays, setExtendDays] = useState(7)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function applyConditionUpdate(idx, updater) {
    if (!contract) return
    try {
      setBusy(true)
      setError(null)
      const updated = conditions.map((c, i) => (i === idx ? updater(c) : c))
      await updateContractConditions(contract.id, updated)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const markCleared = (i) =>
    applyConditionUpdate(i, (c) => ({ ...c, cleared_at: todayDateStr() }))

  const confirmExtend = (i) => {
    applyConditionUpdate(i, (c) => ({
      ...c,
      due_date: addDaysToDateStr(c.due_date, extendDays),
    }))
    setExtendingIdx(null)
    setExtendDays(7)
  }

  return (
    <div className="bg-white border border-cream-200 rounded-lg shadow-sm hover:border-gold-500/50 transition">
      <div className="grid grid-cols-12 md:divide-x divide-cream-200">

        <Link
          to={`/listings/${listing.id}`}
          className="col-span-12 md:col-span-4 px-4 py-2.5 min-w-0 hover:text-gold-600 transition"
        >
          <h3 className="text-sm font-semibold text-navy-900 leading-tight truncate">
            {listing.address}
          </h3>
          <p className="text-xs text-navy-900/60 mt-0.5 truncate">
            {(listing.vendor_names ?? []).join(' & ') || 'No vendor names'}
          </p>
        </Link>

        <div className="col-span-12 md:col-span-2 px-4 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-navy-900/50">Settlement</div>
          <div className="text-xs text-navy-900 font-medium mt-0.5">
            {contract?.settlement_date ? formatAusDate(contract.settlement_date) : '—'}
          </div>
          {contract?.purchase_price != null && (
            <div className="text-xs text-gold-600 font-medium mt-0.5 tabular-nums">
              ${(contract.purchase_price / 1000).toLocaleString()}k
            </div>
          )}
        </div>

        <div className="col-span-12 md:col-span-6 px-4 py-2">
          {conditions.length === 0 ? (
            <p className="text-xs text-navy-900/40 italic py-1">No conditions tracked.</p>
          ) : (
            <ul className="space-y-1">
              {conditions.map((c, i) => {
                const days = daysUntil(c.due_date)
                const cleared = !!c.cleared_at
                const isExtending = extendingIdx === i

                return (
                  <li key={i} className="flex items-center justify-between gap-2 min-h-[24px]">
                    <div className="flex items-center gap-2 min-w-0">
                      {cleared ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      ) : (
                        <UrgencyDot daysUntil={days} />
                      )}
                      <span
                        className={`text-xs truncate ${
                          cleared ? 'text-navy-900/50 line-through' : 'text-navy-900'
                        }`}
                      >
                        {CONDITION_LABELS[c.type] || c.label || 'Other'}
                      </span>
                      <span className="text-[11px] text-navy-900/50 whitespace-nowrap">
                        {formatAusDate(c.due_date)}
                        {!cleared && (
                          <span
                            className={`ml-1 ${
                              days < 3 ? 'text-rose-600 font-medium' : 'text-navy-900/40'
                            }`}
                          >
                            ({days < 0 ? `${Math.abs(days)}d od` : days === 0 ? 'today' : `${days}d`})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {cleared ? (
                        <span className="text-[10px] text-emerald-700 font-medium uppercase tracking-wider">
                          Cleared
                        </span>
                      ) : isExtending ? (
                        <ExtendInput
                          value={extendDays}
                          onChange={setExtendDays}
                          onConfirm={() => confirmExtend(i)}
                          onCancel={() => setExtendingIdx(null)}
                          busy={busy}
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => markCleared(i)}
                            disabled={busy}
                            className="text-[11px] px-2 py-0.5 rounded border border-cream-200 text-navy-900 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => { setExtendingIdx(i); setExtendDays(7) }}
                            disabled={busy}
                            className="text-[11px] px-2 py-0.5 rounded border border-cream-200 text-navy-900 hover:border-gold-500/50 hover:text-gold-600 disabled:opacity-50"
                          >
                            Extend
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function ExtendInput({ value, onChange, onConfirm, onCancel, busy }) {
  return (
    <>
      <span className="text-[11px] text-navy-900/60">+</span>
      <input
        type="number"
        min="1"
        max="365"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm()
          if (e.key === 'Escape') onCancel()
        }}
        autoFocus
        className="w-12 px-1.5 py-0.5 border border-cream-200 rounded text-[11px] text-navy-900 focus:outline-none focus:border-gold-500"
      />
      <span className="text-[11px] text-navy-900/60">d</span>
      <button
        onClick={onConfirm}
        disabled={busy}
        className="text-[11px] px-2 py-0.5 rounded bg-navy-900 text-cream-100 font-medium hover:bg-navy-800 disabled:opacity-50"
      >
        OK
      </button>
      <button
        onClick={onCancel}
        disabled={busy}
        className="text-[11px] px-1.5 py-0.5 text-navy-900/60 hover:text-navy-900"
      >
        ✕
      </button>
    </>
  )
}
