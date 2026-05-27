import { useState, useEffect, useRef } from 'react'
import { updateListing } from '../../lib/listings'
import Card from '../Card'

export default function Notes({ listing, onUpdate }) {
  const [value, setValue] = useState(listing.scratch_notes || '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const lastSavedValue = useRef(listing.scratch_notes || '')

  // Reset when we navigate to a different listing
  useEffect(() => {
    setValue(listing.scratch_notes || '')
    lastSavedValue.current = listing.scratch_notes || ''
    setDirty(false)
  }, [listing.id, listing.scratch_notes])

  async function save() {
    if (!dirty) return
    try {
      setSaving(true)
      await updateListing(listing.id, { scratch_notes: value })
      lastSavedValue.current = value
      setDirty(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
      onUpdate?.()
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Notes" right={
      dirty ? (
        <button
          onClick={save}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-md bg-navy-900 text-cream-100 font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      ) : savedFlash ? (
        <span className="text-xs text-emerald-700 font-medium">Saved</span>
      ) : (
        <span className="text-[11px] text-navy-900/30">Auto-saves on blur</span>
      )
    }>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setDirty(e.target.value !== lastSavedValue.current)
        }}
        onBlur={save}
        placeholder="Scratch pad — anything you want to remember about this listing. Auto-saves when you click away."
        rows={8}
        className="w-full px-3 py-2 border border-cream-200 rounded text-sm text-navy-900 focus:outline-none focus:border-gold-500 resize-y bg-white"
      />
    </Card>
  )
}
