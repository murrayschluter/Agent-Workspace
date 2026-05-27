import { useState } from 'react'
import { updateContractConditions } from '../../lib/contracts'
import {
  formatAusDate,
  formatCurrency,
  daysUntil,
  addDaysToDateStr,
  todayDateStr,
  CONDITION_LABELS,
} from '../../lib/format'
import UrgencyDot from '../UrgencyDot'
import Card from '../Card'

const PREDEFINED_TYPES = ['finance', 'building_pest', 'firb', 'body_corporate']
const DEFAULT_DAYS_FROM_TODAY = {
  finance: 14,
  building_pest: 14,
  firb: 30,
  body_corporate: 21,
  other: 14,
}

export default function ConditionTracker({ listing, onUpdate }) {
  const contract = listing.contracts?.find((c) => c.is_active)
  const [extendingIdx, setExtendingIdx] = useState(null)
  const [extendDays, setExtendDays] = useState(7)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!contract) return null

  const conditions = Array.isArray(contract.conditions) ? contract.conditions : []

  async function applyConditionUpdate(updater) {
    try {
      setBusy(true)
      setError(null)
      const updated = typeof updater === 'function' ? updater(conditions) : updater
      await updateContractConditions(contract.id, updated)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleCleared = (i, makeCleared) =>
    applyConditionUpdate((current) =>
      current.map((c, idx) =>
        idx === i
          ? { ...c, cleared_at: makeCleared ? todayDateStr() : null }
          : c
      )
    )

  const confirmExtend = (i) => {
    applyConditionUpdate((current) =>
      current.map((c, idx) =>
        idx === i
          ? { ...c, due_date: addDaysToDateStr(c.due_date, extendDays) }
          : c
      )
    )
    setExtendingIdx(null)
    setExtendDays(7)
  }

  const removeCondition = (i) => {
    const c = conditions[i]
    const label = CONDITION_LABELS[c.type] || c.label || 'condition'
    if (!confirm(`Remove "${label}" from this contract?`)) return
    applyConditionUpdate((current) => current.filter((_, idx) => idx !== i))
  }

  const addCondition = async ({ type, days, label }) => {
    const due_date = addDaysToDateStr(todayDateStr(), Number(days))
    const newCondition = {
      type,
      due_date,
      ...(type === 'other' ? { label } : {}),
    }
    await applyConditionUpdate([...conditions, newCondition])
    setAdding(false)
  }

  return (
    <Card title="Contract & Conditions" right={
      !adding && (
        <button
          onClick={() => setAdding(true)}
          className="text-sm px-3 py-1.5 rounded-md border border-cream-200 text-navy-900 hover:border-gold-500/40 hover:text-gold-600"
        >
          + Add condition
        </button>
      )
    }>
      <div className="grid grid-cols-3 gap-6 mb-5 pb-5 border-b border-cream-200">
        <Stat label="Contract date"   value={formatAusDate(contract.contract_date)} />
        <Stat label="Settlement date" value={formatAusDate(contract.settlement_date) || '—'} />
        <Stat label="Purchase price"  value={formatCurrency(contract.purchase_price) || '—'} gold />
      </div>

      {adding && (
        <AddConditionForm
          onCancel={() => setAdding(false)}
          onAdd={addCondition}
          busy={busy}
        />
      )}

      {conditions.length === 0 ? (
        !adding && <p className="text-sm text-navy-900/40 italic">No conditions tracked.</p>
      ) : (
        <ul className="space-y-2.5">
          {conditions.map((c, i) => {
            const days = daysUntil(c.due_date)
            const cleared = !!c.cleared_at
            const isExtending = extendingIdx === i

            return (
              <li
                key={i}
                className={`flex items-center justify-between gap-4 p-3 rounded-md border ${
                  cleared ? 'bg-emerald-50/40 border-emerald-200/60' : 'bg-cream-50 border-cream-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {cleared ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shrink-0" />
                  ) : (
                    <UrgencyDot daysUntil={days} />
                  )}
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${cleared ? 'text-emerald-800 line-through' : 'text-navy-900'}`}>
                      {CONDITION_LABELS[c.type] || c.label || 'Other'}
                    </div>
                    <div className="text-xs text-navy-900/60">
                      Due {formatAusDate(c.due_date)}
                      {!cleared && (
                        <span className={`ml-2 ${days < 3 ? 'text-rose-600 font-medium' : 'text-navy-900/40'}`}>
                          ({days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `${days}d`})
                        </span>
                      )}
                      {cleared && (
                        <span className="ml-2 text-emerald-700">
                          Cleared {formatAusDate(c.cleared_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {cleared ? (
                    <>
                      <button
                        onClick={() => toggleCleared(i, false)}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-md text-navy-900/60 hover:text-navy-900 disabled:opacity-50"
                      >
                        Undo
                      </button>
                      <button
                        onClick={() => removeCondition(i)}
                        disabled={busy}
                        className="text-xs px-2 py-1.5 text-navy-900/40 hover:text-rose-600 disabled:opacity-50"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </>
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
                        onClick={() => toggleCleared(i, true)}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-md border border-cream-200 text-navy-900 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
                      >
                        Mark cleared
                      </button>
                      <button
                        onClick={() => { setExtendingIdx(i); setExtendDays(7) }}
                        disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-md border border-cream-200 text-navy-900 hover:border-gold-500/50 hover:text-gold-600 disabled:opacity-50"
                      >
                        Extend
                      </button>
                      <button
                        onClick={() => removeCondition(i)}
                        disabled={busy}
                        className="text-xs px-2 py-1.5 text-navy-900/40 hover:text-rose-600 disabled:opacity-50"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
    </Card>
  )
}

function AddConditionForm({ onCancel, onAdd, busy }) {
  const [type, setType] = useState('finance')
  const [days, setDays] = useState(DEFAULT_DAYS_FROM_TODAY.finance)
  const [label, setLabel] = useState('')
  const [localError, setLocalError] = useState(null)

  function changeType(newType) {
    setType(newType)
    setDays(DEFAULT_DAYS_FROM_TODAY[newType])
    setLocalError(null)
  }

  async function handleAdd() {
    setLocalError(null)
    const n = Number(days)
    if (!n || n <= 0) return setLocalError('Set a valid number of days.')
    if (type === 'other' && !label.trim()) return setLocalError('Set a label for the custom condition.')
    try {
      await onAdd({ type, days: n, label: label.trim() })
    } catch (e) {
      setLocalError(e.message)
    }
  }

  return (
    <div className="mb-4 pb-4 border-b border-cream-200 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-navy-900/50">
        Add new condition
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={type}
          onChange={(e) => changeType(e.target.value)}
          disabled={busy}
          className="input bg-white w-48"
        >
          {PREDEFINED_TYPES.map((t) => (
            <option key={t} value={t}>{CONDITION_LABELS[t]}</option>
          ))}
          <option value="other">Other (custom)</option>
        </select>
        {type === 'other' && (
          <input
            type="text"
            placeholder="Label (e.g. Survey clause)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
            className="input flex-1 min-w-[180px]"
          />
        )}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="365"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            disabled={busy}
            className="input w-20 text-center"
          />
          <span className="text-sm text-navy-900/70">days from today</span>
        </div>
      </div>
      {localError && <p className="text-sm text-rose-600">{localError}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add condition'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-md text-navy-900/60 text-sm hover:text-navy-900"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, gold }) {
  return (
    <div>
      <div className="text-xs text-navy-900/60 mb-1">{label}</div>
      <div className={`font-medium ${gold ? 'text-gold-600' : 'text-navy-900'}`}>{value}</div>
    </div>
  )
}

function ExtendInput({ value, onChange, onConfirm, onCancel, busy }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-navy-900/60">Extend by</span>
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
        className="w-16 px-2 py-1 border border-cream-200 rounded text-sm text-navy-900 focus:outline-none focus:border-gold-500"
      />
      <span className="text-xs text-navy-900/60">days</span>
      <button
        onClick={onConfirm}
        disabled={busy}
        className="text-xs px-3 py-1.5 rounded-md bg-navy-900 text-cream-100 font-medium hover:bg-navy-800 disabled:opacity-50"
      >
        Confirm
      </button>
      <button
        onClick={onCancel}
        disabled={busy}
        className="text-xs px-2 py-1.5 text-navy-900/60 hover:text-navy-900"
      >
        Cancel
      </button>
    </div>
  )
}
