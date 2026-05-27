import { useState } from 'react'
import { createWeeklyLog, updateWeeklyLog, deleteWeeklyLog } from '../../lib/weeklyLogs'
import { formatAusDate, formatCurrency, todayDateStr } from '../../lib/format'
import Card from '../Card'

export default function WeeklyLog({ listing, onUpdate }) {
  const logs = (listing.weekly_logs ?? [])
    .slice()
    .sort((a, b) => new Date(b.week_ending) - new Date(a.week_ending))
  const [adding, setAdding] = useState(false)

  return (
    <Card title="Weekly Activity Log" right={
      !adding && (
        <button
          onClick={() => setAdding(true)}
          className="text-sm px-3 py-1.5 rounded-md border border-cream-200 text-navy-900 hover:border-gold-500/40 hover:text-gold-600"
        >
          + Add week
        </button>
      )
    }>
      {adding && (
        <LogForm
          listingId={listing.id}
          onCancel={() => setAdding(false)}
          onSaved={() => { setAdding(false); onUpdate?.() }}
        />
      )}

      {logs.length === 0 && !adding ? (
        <p className="text-sm text-navy-900/40 italic">No weekly logs yet.</p>
      ) : (
        <ul className="space-y-4">
          {logs.map((l) => <LogItem key={l.id} log={l} onUpdate={onUpdate} />)}
        </ul>
      )}
    </Card>
  )
}

function LogItem({ log, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleDelete() {
    if (!confirm(`Delete the weekly log for week ending ${formatAusDate(log.week_ending)}?`)) return
    try {
      setBusy(true)
      setError(null)
      await deleteWeeklyLog(log.id)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <LogForm
        existingLog={log}
        onCancel={() => setEditing(false)}
        onSaved={() => { setEditing(false); onUpdate?.() }}
      />
    )
  }

  return (
    <li className="border-l-2 border-cream-200 pl-4 py-1 group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-navy-900">
          Week ending {formatAusDate(log.week_ending)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-0.5 text-navy-900/60 hover:text-navy-900"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-xs px-2 py-0.5 text-navy-900/40 hover:text-rose-600 disabled:opacity-50"
          >
            {busy ? '…' : 'Delete'}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-5 text-xs text-navy-900/70 mb-2 flex-wrap">
        <Stat label="Enquiries"   value={log.enquiry_count} />
        <Stat label="Inspections" value={log.inspection_count} />
        <Stat label="Open home"   value={`${log.open_home_groups} groups`} />
        {log.offers_received && (
          <Stat
            label="Offer"
            value={log.offer_amount ? formatCurrency(log.offer_amount) : 'Yes'}
            gold
          />
        )}
      </div>
      {log.price_feedback && (
        <p className="text-sm text-navy-900/80 mt-2">
          <span className="text-navy-900/40 text-xs uppercase tracking-wider mr-1">Price feedback</span>
          {log.price_feedback}
        </p>
      )}
      {log.notes && (
        <p className="text-sm text-navy-900/80 mt-1">
          <span className="text-navy-900/40 text-xs uppercase tracking-wider mr-1">Notes</span>
          {log.notes}
        </p>
      )}
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </li>
  )
}

function Stat({ label, value, gold }) {
  return (
    <span>
      <span className="text-navy-900/40">{label} </span>
      <span className={`font-medium tabular-nums ${gold ? 'text-gold-600' : 'text-navy-900'}`}>
        {value}
      </span>
    </span>
  )
}

// Shared form for both create and edit. If existingLog is passed, it's edit mode.
function LogForm({ listingId, existingLog, onCancel, onSaved }) {
  const isEdit = !!existingLog
  const [form, setForm] = useState(
    existingLog ? toFormState(existingLog) : defaultFormState()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    try {
      setSaving(true)
      setError(null)
      const payload = {
        week_ending: form.week_ending,
        enquiry_count: Number(form.enquiry_count) || 0,
        inspection_count: Number(form.inspection_count) || 0,
        open_home_groups: Number(form.open_home_groups) || 0,
        offers_received: form.offers_received,
        offer_amount: form.offer_amount ? Number(form.offer_amount) : null,
        price_feedback: form.price_feedback.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (isEdit) {
        await updateWeeklyLog(existingLog.id, payload)
      } else {
        await createWeeklyLog(listingId, payload)
      }
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${isEdit ? 'border border-cream-200 rounded-md p-4 bg-cream-50/40' : 'mb-5 pb-5 border-b border-cream-200'} space-y-4`}>
      {isEdit && (
        <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-900/50">
          Editing week ending {formatAusDate(existingLog.week_ending)}
        </h4>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Week ending">
          <input
            type="date"
            value={form.week_ending}
            onChange={(e) => setForm({ ...form, week_ending: e.target.value })}
            className="input"
          />
        </Field>
        <div />
        <Field label="Enquiries">
          <input type="number" min="0" value={form.enquiry_count}
            onChange={(e) => setForm({ ...form, enquiry_count: e.target.value })}
            className="input" />
        </Field>
        <Field label="Inspections">
          <input type="number" min="0" value={form.inspection_count}
            onChange={(e) => setForm({ ...form, inspection_count: e.target.value })}
            className="input" />
        </Field>
        <Field label="Open home groups">
          <input type="number" min="0" value={form.open_home_groups}
            onChange={(e) => setForm({ ...form, open_home_groups: e.target.value })}
            className="input" />
        </Field>
        <div />
      </div>
      <Field label="Offer received this week">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.offers_received}
            onChange={(e) => setForm({ ...form, offers_received: e.target.checked })} />
          <span className="text-sm text-navy-900">Yes</span>
        </label>
        {form.offers_received && (
          <input type="number" min="0" placeholder="Offer amount (AUD)"
            value={form.offer_amount}
            onChange={(e) => setForm({ ...form, offer_amount: e.target.value })}
            className="input mt-2" />
        )}
      </Field>
      <Field label="Price feedback">
        <textarea rows={2} value={form.price_feedback}
          onChange={(e) => setForm({ ...form, price_feedback: e.target.value })}
          placeholder="e.g. Buyers coming in around $850k, feedback is price is slightly high"
          className="input resize-y" />
      </Field>
      <Field label="Notes">
        <textarea rows={2} value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input resize-y" />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50">
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save log'}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="px-4 py-2 rounded-md text-navy-900/60 text-sm hover:text-navy-900">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-navy-900/70 mb-1">
        {label}
        {hint && <span className="text-navy-900/40 ml-2 font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function defaultFormState() {
  return {
    week_ending: todayDateStr(),
    enquiry_count: 0,
    inspection_count: 0,
    open_home_groups: 0,
    offers_received: false,
    offer_amount: '',
    price_feedback: '',
    notes: '',
  }
}

function toFormState(log) {
  return {
    week_ending: log.week_ending ?? todayDateStr(),
    enquiry_count: log.enquiry_count ?? 0,
    inspection_count: log.inspection_count ?? 0,
    open_home_groups: log.open_home_groups ?? 0,
    offers_received: !!log.offers_received,
    offer_amount: log.offer_amount ?? '',
    price_feedback: log.price_feedback ?? '',
    notes: log.notes ?? '',
  }
}
