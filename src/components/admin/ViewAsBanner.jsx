// src/components/admin/ViewAsBanner.jsx
// Persistent yellow banner pinned at the top of the app while a super_admin
// is in admin override mode. Sits ABOVE all routed content (rendered at the
// App root, outside the Layout's sidebar offset).

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdminOverride } from '../../contexts/AdminOverrideContext'

export default function ViewAsBanner() {
  const { isAdminMode, viewingAsUserId, exitAdminMode } = useAdminOverride()
  const [viewedProfile, setViewedProfile] = useState(null)
  const [exiting, setExiting] = useState(false)
  const [exitError, setExitError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!viewingAsUserId) {
      setViewedProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('email, display_name')
      .eq('user_id', viewingAsUserId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setViewedProfile(data || null)
      })
    return () => {
      cancelled = true
    }
  }, [viewingAsUserId])

  if (!isAdminMode) return null

  const label = viewingAsUserId
    ? `Viewing as ${viewedProfile?.display_name || viewedProfile?.email || 'agent'}`
    : 'Admin mode'

  const handleExit = async () => {
    setExiting(true)
    setExitError(null)
    try {
      await exitAdminMode()
    } catch (e) {
      setExitError(e?.message || 'Failed to exit admin mode')
      setExiting(false)
    }
  }

  return (
    <div className="sticky top-0 z-50 bg-yellow-400 text-navy-900 border-b border-yellow-500">
      <div className="px-4 py-2 flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true" className="font-semibold uppercase tracking-wider text-[11px]">
            Admin
          </span>
          <span className="truncate font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {exitError && (
            <span className="text-xs text-red-800">{exitError}</span>
          )}
          <button
            type="button"
            onClick={handleExit}
            disabled={exiting}
            className="text-xs font-semibold underline hover:no-underline disabled:opacity-50"
          >
            {exiting ? 'Exiting...' : 'Exit'}
          </button>
        </div>
      </div>
    </div>
  )
}
