// src/contexts/AdminOverrideContext.jsx
// React context tracking whether a super_admin is in admin override mode,
// and which agent (if any) they're "viewing as". Every state transition
// writes a row to admin_access_log via /api/log-admin-view. Fails closed:
// if the audit log write fails, state does not change.
//
// State is in-memory only (not persisted to URL or storage). A page refresh
// resets to default scope, which is the conservative behaviour for an
// elevated-privilege mode.
//
// SCOPE NOTE on `viewAs` (per Murray's PR #12 review): this context
// currently only tracks `viewingAsUserId`, shows the ViewAsBanner, and
// writes the transition to admin_access_log. It does NOT yet re-scope
// data fetching. Listing hooks (useListings, useListingDetail, etc.)
// don't read `viewingAsUserId`, so a super_admin in "view as agent X"
// still sees the super_admin RLS view (all data) rather than X's
// narrowed view. View-as is intentionally banner-only in Phase 7b — the
// data-fetching consumers will be wired up in a follow-up phase (likely
// Phase 7e or 8) when the listing hooks are refactored to accept an
// effective-viewer-id parameter. The audit-log entry is meaningful even
// without re-scoping: it captures intent ("admin chose to view as X")
// for compliance even if the actual data view is unchanged.

import { createContext, useCallback, useContext, useState } from 'react'
import { supabase } from '../lib/supabase'

const AdminOverrideContext = createContext({
  isAdminMode: false,
  viewingAsUserId: null,
  enterAdminMode: async () => {},
  exitAdminMode: async () => {},
  viewAs: async () => {},
  stopViewingAs: () => {},
})

async function postLog(action, details = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Cannot log admin action: no active session')
  }
  const res = await fetch('/api/log-admin-view', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...details }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error || body?.detail || ''
    } catch {
      // ignore parse errors
    }
    throw new Error(
      `Admin action audit log failed (HTTP ${res.status}): ${detail || 'aborting'}`
    )
  }
}

export function AdminOverrideProvider({ children }) {
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [viewingAsUserId, setViewingAsUserId] = useState(null)

  const enterAdminMode = useCallback(async () => {
    await postLog('enter_admin_mode')
    setIsAdminMode(true)
  }, [])

  const exitAdminMode = useCallback(async () => {
    // Pass viewed_user_id at the top level (not nested in details) so the
    // dedicated `admin_access_log.viewed_user_id` column gets populated.
    // Audit queries that group/filter by that column would otherwise
    // under-count exits if the field were buried in jsonb details.
    await postLog('exit_admin_mode', {
      viewed_user_id: viewingAsUserId,
    })
    setIsAdminMode(false)
    setViewingAsUserId(null)
  }, [viewingAsUserId])

  const viewAs = useCallback(async (userId) => {
    if (!userId) throw new Error('viewAs requires a userId')
    await postLog('view_as', { viewed_user_id: userId })
    setViewingAsUserId(userId)
    setIsAdminMode(true)
  }, [])

  const stopViewingAs = useCallback(() => {
    setViewingAsUserId(null)
  }, [])

  return (
    <AdminOverrideContext.Provider
      value={{
        isAdminMode,
        viewingAsUserId,
        enterAdminMode,
        exitAdminMode,
        viewAs,
        stopViewingAs,
      }}
    >
      {children}
    </AdminOverrideContext.Provider>
  )
}

export function useAdminOverride() {
  return useContext(AdminOverrideContext)
}
