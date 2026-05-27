import { useState } from 'react'
import {
  createService,
  updateService,
  deleteService,
  SERVICE_LABELS,
  SERVICE_ICONS,
} from '../../lib/listingServices'
import { formatAusDate, todayDateStr } from '../../lib/format'
import Card from '../Card'

export default function Services({ listing, onUpdate }) {
  const services = (listing.listing_services ?? []).slice()
  // Active first (sorted by scheduled date asc), then completed (most recent first)
  const active = services
    .filter((s) => !s.completed_at)
    .sort((a, b) => {
      if (!a.scheduled_for && !b.scheduled_for) return 0
      if (!a.scheduled_for) return 1
      if (!b.scheduled_for) return -1
      return new Date(a.scheduled_for) - new Date(b.scheduled_for)
    })
  const completed = services
    .filter((s) => s.completed_at)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

  const [adding, setAdding] = useState(false)

  return (
    <Card title="Services" right={
      !adding && (
        <button
          onClick={() => setAdding(true)}
          className="text-sm px-3 py-1.5 rounded-md border border-cream-200 text-navy-900 hover:border-gold-500/40 hover:text-gold-600"
        >
          + Add service
        </button>
      )
    }>
      {adding && (
        <ServiceForm
          listingId={listing.id}
          onCancel={() => setAdding(false)}
          onSaved={() => { setAdding(false); onUpdate?.() }}
        />
      )}

      {services.length === 0 && !adding ? (
        <p className="text-sm text-navy-900/40 italic">
          No services tracked yet. Photographer, signboard, conveyancer, etc.
        </p>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <Group heading="Active">
              {active.map((s) => <ServiceRow key={s.id} service={s} onUpdate={onUpdate} />)}
            </Group>
          )}
          {completed.length > 0 && (
            <Group heading="Completed" muted>
              {completed.map((s) => <ServiceRow key={s.id} service={s} onUpdate={onUpdate} />)}
            </Group>
          )}
        </div>
      )}
    </Card>
  )
}

function Group({ heading, muted, children }) {
  return (
    <div>
      <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${
        muted ? 'text-navy-900/40' : 'text-navy-900/60'
      }`}>
        {heading}
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  )
}

function ServiceRow({ service, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const completed = !!service.completed_at

  async function markComplete() {
    try {
      setBusy(true)
      setError(null)
      await updateService(service.id, { completed_at: todayDateStr() })
      onUpdate?.()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function unmarkComplete() {
    try {
      setBusy(true)
      setError(null)
      await updateService(service.id, { completed_at: null })
      onUpdate?.()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${SERVICE_LABELS[service.service_type]}${service.provider_name ? ` (${service.provider_name})` : ''}?`)) return
    try {
      setBusy(true)
      setError(null)
      await deleteService(service.id)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <ServiceForm
        existingService={service}
        onCancel={() => setEditing(false)}
        onSaved={() => { setEditing(false); onUpdate?.() }}
      />
    )
  }

  const contact = service.provider_contact || ''
  const isPhone = /^[\d+\s()-]+$/.test(contact.trim())
  const isEmail = contact.includes('@')

  return (
    <li className={`group flex items-start justify-between gap-3 p-3 rounded-md border ${
      completed ? 'bg-emerald-50/30 border-emerald-200/40' : 'bg-cream-50 border-cream-200'
    }`}>
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-lg shrink-0 mt-0.5" aria-hidden>
          {SERVICE_ICONS[service.service_type]}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-navy-900">
            {SERVICE_LABELS[service.service_type]}
            {service.provider_name && (
              <>
                <span className="text-navy-900/30 mx-1.5">·</span>
                <span className={completed ? 'text-navy-900/60' : 'text-navy-900/80'}>
                  {service.provider_name}
                </span>
              </>
            )}
          </div>
          {contact && (
            <div className="text-xs text-navy-900/60 mt-0.5">
              {isEmail ? (
                <a href={`mailto:${contact}`} className="hover:text-gold-600">{contact}</a>
              ) : isPhone ? (
                <a href={`tel:${contact.replace(/\s/g, '')}`} className="hover:text-gold-600">{contact}</a>
              ) : (
                contact
              )}
            </div>
          )}
          <div className="text-xs text-navy-900/50 mt-0.5">
            {service.scheduled_for && (
              <span>Scheduled {formatAusDate(service.scheduled_for)}</span>
            )}
            {completed && (
              <>
                {service.scheduled_for && <span className="mx-1.5 text-navy-900/30">·</span>}
                <span className="text-emerald-700">Completed {formatAusDate(service.completed_at)}</span>
              </>
            )}
          </div>
          {service.notes && (
            <p className="text-xs text-navy-900/70 mt-1.5 whitespace-pre-wrap">
              {service.notes}
            </p>
          )}
          {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!completed && (
          <button
            onClick={markComplete}
            disabled={busy}
            className="text-xs px-2.5 py-1 rounded border border-cream-200 text-navy-900 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50 whitespace-nowrap"
          >
            Mark done
          </button>
        )}
        {completed && (
          <button
            onClick={unmarkComplete}
            disabled={busy}
            className="text-xs px-2.5 py-1 rounded text-navy-900/60 hover:text-navy-900 disabled:opacity-50 whitespace-nowrap"
          >
            Undo
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-xs px-2 py-1 text-navy-900/60 hover:text-navy-900 opacity-0 group-hover:opacity-100 transition"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-xs px-2 py-1 text-navy-900/40 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </li>
  )
}

function ServiceForm({ listingId, existingService, onCancel, onSaved }) {
  const isEdit = !!existingService
  const [form, setForm] = useState(
    existingService ? toFormState(existingService) : defaultFormState()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    try {
      setSaving(true)
      setError(null)
      const payload = {
        service_type: form.service_type,
        provider_name: form.provider_name.trim() || null,
        provider_contact: form.provider_contact.trim() || null,
        scheduled_for: form.scheduled_for || null,
        completed_at: form.completed_at || null,
        notes: form.notes.trim() || null,
      }
      if (isEdit) {
        await updateService(existingService.id, payload)
      } else {
        await createService(listingId, payload)
      }
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${isEdit ? 'border border-cream-200 rounded-md p-3 bg-cream-50/40' : 'mb-4 pb-4 border-b border-cream-200'} space-y-3`}>
      {isEdit && (
        <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-900/50">
          Editing service
        </h4>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            disabled={saving}
            className="input bg-white"
          >
            {Object.entries(SERVICE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Provider name">
          <input
            type="text"
            value={form.provider_name}
            onChange={(e) => setForm({ ...form, provider_name: e.target.value })}
            placeholder="e.g. John Smith Photography"
            disabled={saving}
            className="input"
          />
        </Field>
      </div>
      <Field label="Contact" hint="phone or email">
        <input
          type="text"
          value={form.provider_contact}
          onChange={(e) => setForm({ ...form, provider_contact: e.target.value })}
          placeholder="0400 000 000 or contact@example.com"
          disabled={saving}
          className="input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Scheduled for" hint="optional">
          <input
            type="date"
            value={form.scheduled_for}
            onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
            disabled={saving}
            className="input"
          />
        </Field>
        <Field label="Completed on" hint="optional">
          <input
            type="date"
            value={form.completed_at}
            onChange={(e) => setForm({ ...form, completed_at: e.target.value })}
            disabled={saving}
            className="input"
          />
        </Field>
      </div>
      <Field label="Notes" hint="optional">
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Anything to remember about this booking"
          disabled={saving}
          className="input resize-y"
        />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add service'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-md text-navy-900/60 text-sm hover:text-navy-900"
        >
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
    service_type: 'photographer',
    provider_name: '',
    provider_contact: '',
    scheduled_for: '',
    completed_at: '',
    notes: '',
  }
}

function toFormState(s) {
  return {
    service_type: s.service_type ?? 'other',
    provider_name: s.provider_name ?? '',
    provider_contact: s.provider_contact ?? '',
    scheduled_for: s.scheduled_for ?? '',
    completed_at: s.completed_at ?? '',
    notes: s.notes ?? '',
  }
}
