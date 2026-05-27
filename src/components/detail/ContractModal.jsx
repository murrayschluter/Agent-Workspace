import { useState, useEffect } from 'react'
import { addDaysToDateStr, todayDateStr, formatAusDate, CONDITION_LABELS } from '../../lib/format'

const PREDEFINED_TYPES = ['finance', 'building_pest', 'firb', 'body_corporate']

const DEFAULT_DAYS = {
  finance: 14,
  building_pest: 14,
  firb: 30,
  body_corporate: 21,
}

const DEFAULT_SETTLEMENT_DAYS = 42 // 6 weeks (standard QLD)

let _nextCustomId = 1
function newCustomRow() {
  return { id: `c${_nextCustomId++}`, label: '', days: 14 }
}

function initialPredefined() {
  return {
    finance:        { enabled: false, days: DEFAULT_DAYS.finance },
    building_pest:  { enabled: false, days: DEFAULT_DAYS.building_pest },
    firb:           { enabled: false, days: DEFAULT_DAYS.firb },
    body_corporate: { enabled: false, days: DEFAULT_DAYS.body_corporate },
  }
}

export default function ContractModal({ isOpen, onClose, onSave }) {
  const [contractDate, setContractDate] = useState(todayDateStr())
  const [settlementDate, setSettlementDate] = useState(
    addDaysToDateStr(todayDateStr(), DEFAULT_SETTLEMENT_DAYS)
  )
  const [purchasePrice, setPurchasePrice] = useState('')

  const [predefined, setPredefined] = useState(initialPredefined())
  const [customConditions, setCustomConditions] = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Reset whenever the modal opens
  useEffect(() => {
    if (!isOpen) return
    const today = todayDateStr()
    setContractDate(today)
    setSettlementDate(addDaysToDateStr(today, DEFAULT_SETTLEMENT_DAYS))
    setPurchasePrice('')
    setPredefined(initialPredefined())
    setCustomConditions([])
    setError(null)
  }, [isOpen])

  // Escape closes (but not mid-save)
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, saving, onClose])

  if (!isOpen) return null

  function togglePredefined(type, checked) {
    setPredefined((prev) => ({
      ...prev,
      [type]: { ...prev[type], enabled: checked },
    }))
  }

  function updatePredefinedDays(type, days) {
    setPredefined((prev) => ({
      ...prev,
      [type]: { ...prev[type], days },
    }))
  }

  function addCustom() {
    setCustomConditions((prev) => [...prev, newCustomRow()])
  }
  function removeCustom(id) {
    setCustomConditions((prev) => prev.filter((c) => c.id !== id))
  }
  function updateCustom(id, field, value) {
    setCustomConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  async function handleSubmit() {
    setError(null)

    if (!contractDate) return setError('Contract date is required.')
    if (!settlementDate) return setError('Settlement date is required.')
    if (new Date(settlementDate) <= new Date(contractDate)) {
      return setError('Settlement date must be after contract date.')
    }
    if (purchasePrice && Number(purchasePrice) <= 0) {
      return setError('Purchase price must be greater than 0 (or leave blank).')
    }

    const conditionsList = []

    // Predefined
    for (const type of PREDEFINED_TYPES) {
      const c = predefined[type]
      if (!c.enabled) continue
      const days = Number(c.days)
      if (!days || days <= 0) {
        return setError(`Set a valid number of days for ${CONDITION_LABELS[type]}.`)
      }
      conditionsList.push({
        type,
        due_date: addDaysToDateStr(contractDate, days),
      })
    }

    // Custom (skip rows that are completely empty; error on partial)
    for (const c of customConditions) {
      const label = c.label.trim()
      const days = Number(c.days)
      const hasLabel = !!label
      const hasDays = !!days && days > 0
      if (!hasLabel && !hasDays) continue
      if (!hasLabel) return setError('Each custom condition needs a label.')
      if (!hasDays) return setError(`Set days for custom condition "${label}".`)
      conditionsList.push({
        type: 'other',
        label,
        due_date: addDaysToDateStr(contractDate, days),
      })
    }

    try {
      setSaving(true)
      await onSave({
        contract_date: contractDate,
        settlement_date: settlementDate,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        conditions: conditionsList,
      })
      onClose()
    } catch (e) {
      setError(e.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-modal-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <header className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <h2 id="contract-modal-title" className="font-semibold text-navy-900">
            Move to Under Contract
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-navy-900/40 hover:text-navy-900 disabled:opacity-50 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contract date" required>
              <input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                disabled={saving}
                className="input"
              />
            </Field>
            <Field label="Settlement date" required>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                disabled={saving}
                className="input"
              />
            </Field>
          </div>

          <Field label="Purchase price" hint="optional">
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="e.g. 875000"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              disabled={saving}
              className="input"
            />
          </Field>

          {/* Predefined conditions */}
          <div>
            <div className="text-xs font-medium text-navy-900/70 mb-2">
              Conditions
              <span className="text-navy-900/40 ml-2 font-normal">
                (days from contract date)
              </span>
            </div>
            <div className="space-y-2 border border-cream-200 rounded-md p-3 bg-cream-50/40">
              {PREDEFINED_TYPES.map((type) => {
                const c = predefined[type]
                return (
                  <ConditionRow key={type}>
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) => togglePredefined(type, e.target.checked)}
                        disabled={saving}
                        className="rounded border-cream-200"
                      />
                      <span
                        className={`text-sm ${
                          c.enabled ? 'text-navy-900 font-medium' : 'text-navy-900/70'
                        }`}
                      >
                        {CONDITION_LABELS[type]}
                      </span>
                    </label>
                    <DaysInput
                      days={c.days}
                      onChange={(v) => updatePredefinedDays(type, v)}
                      contractDate={contractDate}
                      disabled={saving || !c.enabled}
                      active={c.enabled}
                    />
                  </ConditionRow>
                )
              })}
            </div>
          </div>

          {/* Custom conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-navy-900/70">
                Custom conditions
                <span className="text-navy-900/40 ml-2 font-normal">
                  (label + days)
                </span>
              </div>
              <button
                type="button"
                onClick={addCustom}
                disabled={saving}
                className="text-xs px-2 py-1 rounded border border-cream-200 text-navy-900 hover:border-gold-500/50 hover:text-gold-600 disabled:opacity-50"
              >
                + Add custom condition
              </button>
            </div>

            {customConditions.length === 0 ? (
              <p className="text-xs text-navy-900/40 italic px-1 py-1">
                No custom conditions. Add one for clauses outside the standard four.
              </p>
            ) : (
              <div className="space-y-2 border border-cream-200 rounded-md p-3 bg-cream-50/40">
                {customConditions.map((c) => (
                  <ConditionRow key={c.id}>
                    <input
                      type="text"
                      placeholder="Label (e.g. Survey clause)"
                      value={c.label}
                      onChange={(e) => updateCustom(c.id, 'label', e.target.value)}
                      disabled={saving}
                      className="input flex-1 min-w-0"
                    />
                    <DaysInput
                      days={c.days}
                      onChange={(v) => updateCustom(c.id, 'days', v)}
                      contractDate={contractDate}
                      disabled={saving}
                      active
                    />
                    <button
                      type="button"
                      onClick={() => removeCustom(c.id)}
                      disabled={saving}
                      className="text-navy-900/40 hover:text-rose-600 disabled:opacity-50 px-2 text-sm"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </ConditionRow>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-cream-200 flex justify-end gap-2 bg-cream-50/30">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-md text-navy-900/70 text-sm hover:text-navy-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
          >
            {saving ? 'Creating contract…' : 'Create contract → Under Contract'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function ConditionRow({ children }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-white border border-cream-200">
      {children}
    </div>
  )
}

function DaysInput({ days, onChange, contractDate, disabled, active }) {
  const numericDays = Number(days)
  const computedDate =
    numericDays > 0 && contractDate
      ? addDaysToDateStr(contractDate, numericDays)
      : null
  return (
    <div className="flex items-center gap-2 shrink-0">
      <input
        type="number"
        min="1"
        max="365"
        value={days}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input w-16 text-center"
      />
      <span className={`text-xs ${active ? 'text-navy-900/70' : 'text-navy-900/30'}`}>
        days
      </span>
      {computedDate && active && (
        <span className="text-[11px] text-navy-900/50 whitespace-nowrap">
          → {formatAusDate(computedDate)}
        </span>
      )}
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-navy-900/70 mb-1">
        {label}
        {required && <span className="text-rose-600 ml-0.5">*</span>}
        {hint && <span className="text-navy-900/40 ml-2 font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  )
}
