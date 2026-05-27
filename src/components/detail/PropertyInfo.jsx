import { useState } from 'react'
import { updateListing } from '../../lib/listings'
import { daysOnMarket, formatAusDate, CAMPAIGN_TYPE_LABELS } from '../../lib/format'
import Card from '../Card'

export default function PropertyInfo({ listing, onUpdate }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <EditForm
        listing={listing}
        onCancel={() => setEditing(false)}
        onSaved={() => { setEditing(false); onUpdate?.() }}
      />
    )
  }

  return (
    <Card title="Property" right={
      <button
        onClick={() => setEditing(true)}
        className="text-sm px-3 py-1.5 text-navy-900/60 hover:text-gold-600"
      >
        Edit
      </button>
    }>
      <dl className="space-y-4 text-sm">
        <DisplayField label="Address">{listing.address}</DisplayField>
        <DisplayField label="REA listing">
          {listing.rea_url ? (
            <a
              href={listing.rea_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-600 hover:underline break-all"
            >
              {listing.rea_url.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span className="text-navy-900/40 italic">Not set</span>
          )}
        </DisplayField>
        <DisplayField label="Vendor names">
          {listing.vendor_names?.length
            ? listing.vendor_names.join(', ')
            : <span className="text-navy-900/40 italic">None</span>}
        </DisplayField>
        <DisplayField label="Vendor phones">
          {listing.vendor_phones?.length ? (
            <div className="space-y-0.5">
              {listing.vendor_phones.map((p, i) => (
                <a key={i} href={`tel:${p.replace(/\s/g, '')}`} className="block hover:text-gold-600">
                  {p}
                </a>
              ))}
            </div>
          ) : <span className="text-navy-900/40 italic">None</span>}
        </DisplayField>
        <DisplayField label="Vendor emails">
          {listing.vendor_emails?.length ? (
            <div className="space-y-0.5">
              {listing.vendor_emails.map((e, i) => (
                <a key={i} href={`mailto:${e}`} className="block hover:text-gold-600 break-all">
                  {e}
                </a>
              ))}
            </div>
          ) : <span className="text-navy-900/40 italic">None</span>}
        </DisplayField>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-cream-200">
          <DisplayField label="Campaign">
            {CAMPAIGN_TYPE_LABELS[listing.campaign_type] || listing.campaign_type}
          </DisplayField>
          <DisplayField label="Tenanted">{listing.is_tenanted ? 'Yes' : 'No'}</DisplayField>
          <DisplayField label="Listed">{formatAusDate(listing.list_date)}</DisplayField>
          <DisplayField label="On market">
            <span className="font-medium tabular-nums">{daysOnMarket(listing.list_date)}d</span>
          </DisplayField>
        </div>
      </dl>
    </Card>
  )
}

function EditForm({ listing, onCancel, onSaved }) {
  const [form, setForm] = useState(toFormState(listing))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    try {
      setSaving(true)
      setError(null)
      await updateListing(listing.id, fromFormState(form))
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Edit property" right={
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-sm px-3 py-1.5 text-navy-900/60 hover:text-navy-900"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="text-sm px-3 py-1.5 rounded-md bg-navy-900 text-cream-100 hover:bg-navy-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    }>
      <div className="space-y-4">
        <Field label="Address">
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="REA listing URL">
          <input
            type="url"
            value={form.rea_url}
            onChange={(e) => setForm({ ...form, rea_url: e.target.value })}
            placeholder="https://realestate.com.au/..."
            className="input"
          />
        </Field>
        <Field label="Vendor names" hint="one per line">
          <textarea
            rows={3}
            value={form.vendor_names}
            onChange={(e) => setForm({ ...form, vendor_names: e.target.value })}
            className="input resize-y"
          />
        </Field>
        <Field label="Vendor phones" hint="one per line">
          <textarea
            rows={2}
            value={form.vendor_phones}
            onChange={(e) => setForm({ ...form, vendor_phones: e.target.value })}
            className="input resize-y"
          />
        </Field>
        <Field label="Vendor emails" hint="one per line">
          <textarea
            rows={2}
            value={form.vendor_emails}
            onChange={(e) => setForm({ ...form, vendor_emails: e.target.value })}
            className="input resize-y"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Campaign type">
            <select
              value={form.campaign_type}
              onChange={(e) => setForm({ ...form, campaign_type: e.target.value })}
              className="input bg-white"
            >
              <option value="private_treaty">Private Treaty</option>
              <option value="auction">Auction</option>
              <option value="eoi">Expression of Interest</option>
            </select>
          </Field>
          <Field label="List date">
            <input
              type="date"
              value={form.list_date}
              onChange={(e) => setForm({ ...form, list_date: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <Field label="Tenanted">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_tenanted}
              onChange={(e) => setForm({ ...form, is_tenanted: e.target.checked })}
              className="rounded border-cream-200"
            />
            <span className="text-sm text-navy-900">Property is currently tenanted</span>
          </label>
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Card>
  )
}

function DisplayField({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-navy-900/50 mb-1">{label}</dt>
      <dd className="text-navy-900">{children}</dd>
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

function toFormState(l) {
  return {
    address: l.address ?? '',
    rea_url: l.rea_url ?? '',
    vendor_names: (l.vendor_names ?? []).join('\n'),
    vendor_phones: (l.vendor_phones ?? []).join('\n'),
    vendor_emails: (l.vendor_emails ?? []).join('\n'),
    campaign_type: l.campaign_type ?? 'private_treaty',
    list_date: l.list_date ?? '',
    is_tenanted: !!l.is_tenanted,
  }
}

function fromFormState(f) {
  const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  return {
    address: f.address.trim(),
    rea_url: f.rea_url.trim() || null,
    vendor_names: lines(f.vendor_names),
    vendor_phones: lines(f.vendor_phones),
    vendor_emails: lines(f.vendor_emails),
    campaign_type: f.campaign_type,
    list_date: f.list_date,
    is_tenanted: f.is_tenanted,
  }
}
