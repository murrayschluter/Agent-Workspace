// src/components/sharing/ShareDialog.jsx
// Per-listing share panel. Lists collaborators with their level + remove button
// (visible to those who can manage). Invite form lets a manager add another
// profile at a chosen access level.
//
// Permission model (mirrors can_edit_listing helper in supabase/auth/06_helpers.sql):
//   canManage = current user is super_admin, OR the listing owner, OR an
//   existing co_owner collaborator.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../../hooks/useProfile'
import CollaboratorRow from './CollaboratorRow'

export default function ShareDialog({ listingId, ownerId, onClose }) {
  const { profile } = useProfile()
  const [collaborators, setCollaborators] = useState([])
  const [profiles, setProfiles] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [level, setLevel] = useState('viewer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const canManage =
    profile?.role === 'super_admin' ||
    profile?.user_id === ownerId ||
    collaborators.some(
      (c) => c.user_id === profile?.user_id && c.level === 'co_owner'
    )

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('listing_collaborators')
      .select('id, level, user_id, profiles!inner(email, display_name)')
      .eq('listing_id', listingId)
    if (error) setError(error.message)
    else setCollaborators(data || [])
  }, [listingId])

  useEffect(() => {
    refresh()
    supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .order('email')
      .then(({ data }) => setProfiles(data || []))
  }, [listingId, refresh])

  // Esc closes (but not mid-write)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function invite() {
    if (!selectedUserId || !profile?.user_id) return
    try {
      setBusy(true)
      setError(null)
      const { error } = await supabase.from('listing_collaborators').insert({
        listing_id: listingId,
        user_id: selectedUserId,
        level,
        invited_by: profile.user_id,
      })
      if (error) throw error
      setSelectedUserId('')
      setLevel('viewer')
      await refresh()
    } catch (e) {
      setError(e.message || 'Failed to invite')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      setBusy(true)
      setError(null)
      const { error } = await supabase
        .from('listing_collaborators')
        .delete()
        .eq('id', id)
      if (error) throw error
      await refresh()
    } catch (e) {
      setError(e.message || 'Failed to remove')
    } finally {
      setBusy(false)
    }
  }

  // Filter out current user, owner, and existing collaborators from the invite picker.
  const invitable = profiles.filter(
    (p) =>
      p.user_id !== profile?.user_id &&
      p.user_id !== ownerId &&
      !collaborators.some((c) => c.user_id === p.user_id)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="bg-cream-50 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <header className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <h2 id="share-dialog-title" className="font-semibold text-navy-900">
            Share this listing
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-navy-900/40 hover:text-navy-900 disabled:opacity-50 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="px-6 py-5 space-y-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-900/60 mb-2">
              Current collaborators
            </h3>
            <ul className="space-y-1.5">
              {collaborators.map((c) => (
                <CollaboratorRow
                  key={c.id}
                  collaborator={c}
                  canManage={canManage}
                  onRemove={() => remove(c.id)}
                  busy={busy}
                />
              ))}
              {collaborators.length === 0 && (
                <li className="text-sm text-navy-900/50 italic">
                  No collaborators yet.
                </li>
              )}
            </ul>
          </section>

          {canManage && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-900/60 mb-2">
                Invite
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={busy || invitable.length === 0}
                  className="flex-1 px-3 py-2 text-sm border border-cream-200 rounded-md bg-white focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 disabled:opacity-50"
                >
                  <option value="">
                    {invitable.length === 0
                      ? 'No one to invite'
                      : 'Select user…'}
                  </option>
                  {invitable.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.display_name ? `${p.display_name} (${p.email})` : p.email}
                    </option>
                  ))}
                </select>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  disabled={busy}
                  className="px-3 py-2 text-sm border border-cream-200 rounded-md bg-white focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 disabled:opacity-50"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="co_owner">Co-owner</option>
                </select>
                <button
                  onClick={invite}
                  disabled={!selectedUserId || busy}
                  className="px-4 py-2 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Invite'}
                </button>
              </div>
            </section>
          )}

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-cream-200 flex justify-end bg-cream-50/30">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-md text-navy-900/70 text-sm hover:text-navy-900 disabled:opacity-50"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
