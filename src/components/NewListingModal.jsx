import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createListing } from '../lib/listings'
import { todayDateStr } from '../lib/format'

function initialForm() {
  return {
    address: '',
    rea_url: '',
    vendor_names: '',
    vendor_phones: '',
    vendor_emails: '',
    campaign_type: 'private_treaty',
    list_date: todayDateStr(),
    is_tenanted: false,
  }
}

export default function NewListingModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // Reset whenever the modal opens
  useEffect(() => {
    if (!isOpen) return
    setForm(initialForm())
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

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    setError(null)

    const address = form.address.trim()
    if (!address) return setError('Address is required.')
    if (!form.list_date) return setError('List date is required.')

    const lines = (s) =>
      s.split('\n').map((x) => x.trim()).filter(Boolean)

    try {
      setSaving(true)
      const newListing = await createListing({
        address,
        rea_url: form.rea_url.trim() || null,
        vendor_names: lines(form.vendor_names),
        vendor_phones: lines(form.vendor_phones),
        vendor_emails: lines(form.vendor_emails),
        campaign_type: form.campaign_type,
        list_date: form.list_date,
        is_tenanted: form.is_tenanted,
        // stage defaults to 'listed' in the DB
      })
      onCreated?.(newListing)
      navigate(`/listings/${newListing.id}`)
    } catch (e) {
      setError(e.message || 'Failed to create listing.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-listing-modal-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <header className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <h2 id="new-listing-modal-title" className="font-semibold text-navy-900">
            Add new listing
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

        <div className="px-6 py-5 space-y-4">
          <Field label="Address" required>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="e.g. 12 Banksia Street, Caboolture QLD 4510"
              autoFocus
              disabled={saving}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="REA listing URL" hint="optional">
              <input
                type="url"
                value={form.rea_url}
                onChange={(e) => update('rea_url', e.target.value)}
                placeholder="https://realestate.com.au/..."
                disabled={saving}
                className="input"
              />
            </Field>
            <Field label="Campaign type">
              <select
                value={form.campaign_type}
                onChange={(e) => update('campaign_type', e.target.value)}
                disabled={saving}
                className="input bg-white"
              >
                <option value="private_treaty">Private Treaty</option>
                <option value="auction">Auction</option>
                <option value="eoi">Expression of Interest</option>
              </select>
            </Field>
          </div>

          <Field label="Vendor names" hint="one per line">
            <textarea
              rows={3}
              value={form.vendor_names}
              onChange={(e) => update('vendor_names', e.target.value)}
              placeholder="John Smith"
              disabled={saving}
              className="input resize-y"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Vendor phones" hint="one per line">
              <textarea
                rows={2}
                value={form.vendor_phones}
                onChange={(e) => update('vendor_phones', e.target.value)}
                placeholder="0400 000 000"
                disabled={saving}
                className="input resize-y"
              />
            </Field>
            <Field label="Vendor emails" hint="one per line">
              <textarea
                rows={2}
                value={form.vendor_emails}
                onChange={(e) => update('vendor_emails', e.target.value)}
                placeholder="vendor@example.com"
                disabled={saving}
                className="input resize-y"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="List date" required>
              <input
                type="date"
                value={form.list_date}
                onChange={(e) => update('list_date', e.target.value)}
                disabled={saving}
                className="input"
              />
            </Field>
            <Field label="Tenanted">
              <label className="inline-flex items-center gap-2 cursor-pointer h-9">
                <input
                  type="checkbox"
                  checked={form.is_tenanted}
                  onChange={(e) => update('is_tenanted', e.target.checked)}
                  disabled={saving}
                  className="rounded border-cream-200"
                />
                <span className="text-sm text-navy-900">Currently tenanted</span>
              </label>
            </Field>
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
            {saving ? 'Creating…' : 'Create listing'}
          </button>
        </footer>
      </div>
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
