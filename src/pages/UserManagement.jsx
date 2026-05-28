// src/pages/UserManagement.jsx
// Super_admin-only user management page. Lists all profiles, per-row role
// change + deactivate.
//
// Behaviour:
// - Non-super_admin (or missing profile) -> redirect to /.
// - Loads all profiles ordered by created_at ASC.
// - Per row: role dropdown (pending / agent / super_admin); Deactivate button
//   (confirm -> set role to 'pending').
// - Each role change posts to /api/log-admin-view with action='role_change' and
//   details={ previous_role, new_role, target_user_id }.
// - Each deactivation posts action='deactivate_user' with details capturing
//   the previous role and target user.
// - Reassignment of the leaver's listings (owner_id) is intentionally NOT in
//   the UI: it's a manual SQL step per the spec's leaver flow. We surface a
//   note immediately after deactivation.
// - Audit log writes are wrapped in try/catch so a logging failure surfaces
//   to the operator but does not roll back the UI update (the spec marks the
//   profiles update as the authoritative source of truth).

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'

const ROLE_OPTIONS = ['pending', 'agent', 'super_admin']

async function postAuditLog(payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('No active session for audit log POST')
  }
  const res = await fetch('/api/log-admin-view', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error || body?.detail || ''
    } catch {
      // ignore
    }
    throw new Error(
      `Audit log failed (HTTP ${res.status}): ${detail || 'unknown error'}`
    )
  }
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

export default function UserManagement() {
  const { profile, loading: profileLoading } = useProfile()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [rowError, setRowError] = useState({}) // { [user_id]: 'message' }
  const [rowBusy, setRowBusy] = useState({}) // { [user_id]: boolean }
  const [notice, setNotice] = useState(null)

  const refresh = async () => {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, role, vault_user_id, created_at')
      .order('created_at', { ascending: true })
    if (error) {
      setLoadError(error.message || 'Failed to load profiles')
      setUsers([])
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (profileLoading) return
    if (profile?.role === 'super_admin') {
      refresh()
    }
  }, [profile, profileLoading])

  if (profileLoading) {
    return (
      <div className="max-w-6xl">
        <h1 className="text-2xl font-semibold text-navy-900">User management</h1>
        <p className="text-sm text-navy-900/60 mt-1">Loading...</p>
      </div>
    )
  }

  if (profile && profile.role !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  const setError = (userId, message) =>
    setRowError((prev) => ({ ...prev, [userId]: message }))
  const clearError = (userId) =>
    setRowError((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
  const setBusy = (userId, busy) =>
    setRowBusy((prev) => {
      const next = { ...prev }
      if (busy) next[userId] = true
      else delete next[userId]
      return next
    })

  const changeRole = async (user, newRole) => {
    if (newRole === user.role) return
    const previousRole = user.role
    clearError(user.user_id)
    setBusy(user.user_id, true)

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', user.user_id)

    if (updateErr) {
      setBusy(user.user_id, false)
      setError(user.user_id, updateErr.message || 'Role update failed')
      return
    }

    // Optimistic local update so the dropdown reflects the new role even if
    // the audit log POST fails below.
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === user.user_id ? { ...u, role: newRole } : u
      )
    )

    try {
      await postAuditLog({
        action: 'role_change',
        viewed_user_id: user.user_id,
        details: {
          previous_role: previousRole,
          new_role: newRole,
          target_user_id: user.user_id,
        },
      })
    } catch (e) {
      setError(
        user.user_id,
        `Role updated but audit log failed: ${e.message || 'unknown error'}`
      )
    }
    setBusy(user.user_id, false)
  }

  const deactivate = async (user) => {
    if (user.role === 'pending') return
    const ok = window.confirm(
      `Deactivate ${user.display_name || user.email}? Their role will be set to pending and they will lose access on next page load. You will still need to reassign their listings via SQL.`
    )
    if (!ok) return

    const previousRole = user.role
    clearError(user.user_id)
    setNotice(null)
    setBusy(user.user_id, true)

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ role: 'pending' })
      .eq('user_id', user.user_id)

    if (updateErr) {
      setBusy(user.user_id, false)
      setError(user.user_id, updateErr.message || 'Deactivation failed')
      return
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === user.user_id ? { ...u, role: 'pending' } : u
      )
    )
    setNotice(
      `${
        user.display_name || user.email
      } is now pending. Reassign their listings via SQL: UPDATE listings SET owner_id = '<new>' WHERE owner_id = '${user.user_id}';`
    )

    try {
      await postAuditLog({
        action: 'deactivate_user',
        viewed_user_id: user.user_id,
        details: {
          previous_role: previousRole,
          target_user_id: user.user_id,
          email: user.email,
        },
      })
    } catch (e) {
      setError(
        user.user_id,
        `Deactivated but audit log failed: ${e.message || 'unknown error'}`
      )
    }
    setBusy(user.user_id, false)
  }

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">User management</h1>
        <p className="text-sm text-navy-900/60 mt-1">
          {loading
            ? 'Loading...'
            : `${users.length} ${users.length === 1 ? 'user' : 'users'}`}
        </p>
      </header>

      {notice && (
        <div className="rounded-md border border-gold-500/40 bg-gold-400/10 p-4">
          <p className="text-sm text-navy-900 whitespace-pre-wrap">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="mt-2 text-xs text-navy-900/60 underline hover:text-navy-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4">
          <h2 className="text-sm font-semibold text-rose-800">
            Couldn't load profiles
          </h2>
          <p className="mt-1 text-sm text-rose-700 whitespace-pre-wrap">
            {loadError}
          </p>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 text-sm px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && users.length === 0 ? (
        <div className="rounded-lg border border-cream-200 bg-white p-6">
          <p className="text-sm text-navy-900/60">No profiles yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-cream-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-cream-200 bg-cream-50/60">
              <tr>
                <th className="py-2 px-3 font-medium text-navy-900/70">
                  Email
                </th>
                <th className="py-2 px-3 font-medium text-navy-900/70">
                  Display name
                </th>
                <th className="py-2 px-3 font-medium text-navy-900/70">Role</th>
                <th className="py-2 px-3 font-medium text-navy-900/70">
                  Vault user ID
                </th>
                <th className="py-2 px-3 font-medium text-navy-900/70 whitespace-nowrap">
                  Created
                </th>
                <th className="py-2 px-3 font-medium text-navy-900/70">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.user_id === profile?.user_id
                const busy = !!rowBusy[u.user_id]
                const err = rowError[u.user_id]
                return (
                  <tr
                    key={u.user_id}
                    className="border-b border-cream-200 last:border-b-0 align-top"
                  >
                    <td className="py-2 px-3 text-navy-900/80">{u.email}</td>
                    <td className="py-2 px-3 text-navy-900/80">
                      {u.display_name || (
                        <span className="text-navy-900/40">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={u.role}
                        disabled={busy}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="input bg-white text-sm w-40"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      {err && (
                        <p className="mt-1 text-xs text-rose-700 whitespace-pre-wrap">
                          {err}
                        </p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {u.vault_user_id ? (
                        <code
                          className="text-[11px] text-navy-900/70"
                          title={u.vault_user_id}
                        >
                          {u.vault_user_id.length > 12
                            ? `${u.vault_user_id.slice(0, 12)}…`
                            : u.vault_user_id}
                        </code>
                      ) : (
                        <span className="text-navy-900/40">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-navy-900/70 whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => deactivate(u)}
                        disabled={busy || isSelf || u.role === 'pending'}
                        title={
                          isSelf
                            ? 'You cannot deactivate yourself'
                            : u.role === 'pending'
                            ? 'Already pending'
                            : 'Demote to pending'
                        }
                        className="text-xs px-3 py-1.5 rounded-md border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-navy-900/60">
        Deactivating a user demotes them to <code>pending</code>. To reassign
        their listings to another agent, run the following SQL in the Supabase
        SQL editor (this step is deliberately not in the UI for V1):
        <br />
        <code className="text-[11px]">
          UPDATE listings SET owner_id = '&lt;new_owner_uuid&gt;' WHERE owner_id
          = '&lt;leaver_uuid&gt;';
        </code>
      </p>
    </div>
  )
}
