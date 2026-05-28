// src/pages/AuditLog.jsx
// Super_admin-only audit log view. Lists rows from admin_access_log.
//
// Behaviour:
// - Non-super_admin (or missing profile) -> redirect to /.
// - Loads the most recent 500 rows once, ordered by accessed_at DESC.
// - Client-side filters: by viewer, by action, and date range (7d / 30d / all).
// - Renders viewer/subject as display names where possible (joined off profiles
//   + listings). Falls back to short uuid prefix when a referenced user/listing
//   has been deleted (FKs are ON DELETE SET NULL).
// - "When" shows a compact relative time with the absolute ISO on hover.
// - Details column shows the jsonb payload compactly.

import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'

const PAGE_LIMIT = 500

// Recognised actions from /api/log-admin-view's allowlist. Used to populate
// the action filter dropdown.
const ACTIONS = [
  'enter_admin_mode',
  'exit_admin_mode',
  'view_as',
  'view_listing',
  'admin_search',
  'delete_listing',
  'delete_child_record',
  'deactivate_user',
  'reassign_owner',
  'role_change',
]

function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`
  return `${Math.round(diffSec / 86400)}d ago`
}

function shortId(id) {
  return id ? id.slice(0, 8) : ''
}

export default function AuditLog() {
  const { profile, loading: profileLoading } = useProfile()
  const [rows, setRows] = useState([])
  const [usersById, setUsersById] = useState({})
  const [listingsById, setListingsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [viewerFilter, setViewerFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateRange, setDateRange] = useState('all') // '7d' | '30d' | 'all'

  useEffect(() => {
    if (profileLoading) return
    if (profile?.role !== 'super_admin') return

    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      const { data: logRows, error: logErr } = await supabase
        .from('admin_access_log')
        .select(
          'id, action, viewer_user_id, viewed_user_id, viewed_listing_id, details, accessed_at'
        )
        .order('accessed_at', { ascending: false })
        .limit(PAGE_LIMIT)

      if (cancelled) return
      if (logErr) {
        setError(logErr.message || 'Failed to load audit log')
        setLoading(false)
        return
      }

      const logs = logRows || []

      // Resolve display names for any user_id / listing_id referenced.
      const userIds = Array.from(
        new Set(
          logs.flatMap((r) => [r.viewer_user_id, r.viewed_user_id]).filter(Boolean)
        )
      )
      const listingIds = Array.from(
        new Set(logs.map((r) => r.viewed_listing_id).filter(Boolean))
      )

      const [profilesRes, listingsRes] = await Promise.all([
        userIds.length
          ? supabase
              .from('profiles')
              .select('user_id, email, display_name')
              .in('user_id', userIds)
          : Promise.resolve({ data: [] }),
        listingIds.length
          ? supabase
              .from('listings')
              .select('id, address')
              .in('id', listingIds)
          : Promise.resolve({ data: [] }),
      ])

      if (cancelled) return

      const userMap = {}
      for (const p of profilesRes.data || []) userMap[p.user_id] = p
      const listingMap = {}
      for (const l of listingsRes.data || []) listingMap[l.id] = l

      setRows(logs)
      setUsersById(userMap)
      setListingsById(listingMap)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [profile, profileLoading])

  const filtered = useMemo(() => {
    let result = rows
    if (viewerFilter) {
      const q = viewerFilter.toLowerCase().trim()
      result = result.filter((r) => {
        const u = usersById[r.viewer_user_id]
        const hay = `${u?.display_name || ''} ${u?.email || ''} ${r.viewer_user_id || ''}`
          .toLowerCase()
        return hay.includes(q)
      })
    }
    if (actionFilter) {
      result = result.filter((r) => r.action === actionFilter)
    }
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : 30
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      result = result.filter(
        (r) => new Date(r.accessed_at).getTime() >= cutoff
      )
    }
    return result
  }, [rows, usersById, viewerFilter, actionFilter, dateRange])

  if (profileLoading) {
    return (
      <div className="max-w-6xl">
        <h1 className="text-2xl font-semibold text-navy-900">Audit log</h1>
        <p className="text-sm text-navy-900/60 mt-1">Loading...</p>
      </div>
    )
  }

  if (profile && profile.role !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Audit log</h1>
        <p className="text-sm text-navy-900/60 mt-1">
          {loading
            ? 'Loading...'
            : `${filtered.length} of ${rows.length} events (most recent ${PAGE_LIMIT})`}
        </p>
      </header>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-navy-900/60 mb-1">
            Viewer
          </label>
          <input
            type="search"
            value={viewerFilter}
            onChange={(e) => setViewerFilter(e.target.value)}
            placeholder="Email or name..."
            className="input w-64 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-navy-900/60 mb-1">
            Action
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input bg-white text-sm w-56"
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-navy-900/60 mb-1">
            Date range
          </label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input bg-white text-sm w-40"
          >
            <option value="all">All</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
        {(viewerFilter || actionFilter || dateRange !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setViewerFilter('')
              setActionFilter('')
              setDateRange('all')
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-cream-200 bg-white text-navy-900/70 hover:border-gold-500/40 hover:text-navy-900"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4">
          <p className="text-sm text-rose-700 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-lg border border-cream-200 bg-white p-6">
          <p className="text-sm text-navy-900/60">
            {rows.length === 0
              ? 'No audit log entries yet.'
              : 'No entries match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-cream-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-cream-200 bg-cream-50/60">
              <tr>
                <th className="py-2 px-3 font-medium text-navy-900/70 whitespace-nowrap">
                  When
                </th>
                <th className="py-2 px-3 font-medium text-navy-900/70 whitespace-nowrap">
                  Action
                </th>
                <th className="py-2 px-3 font-medium text-navy-900/70">Viewer</th>
                <th className="py-2 px-3 font-medium text-navy-900/70">Subject</th>
                <th className="py-2 px-3 font-medium text-navy-900/70">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const viewer = usersById[r.viewer_user_id]
                const viewedUser = usersById[r.viewed_user_id]
                const viewedListing = listingsById[r.viewed_listing_id]
                const viewerLabel = viewer
                  ? viewer.display_name || viewer.email
                  : r.viewer_user_id
                  ? `${shortId(r.viewer_user_id)} (deleted user)`
                  : '—'
                let subjectLabel = ''
                if (viewedUser) {
                  subjectLabel = viewedUser.display_name || viewedUser.email
                } else if (r.viewed_user_id) {
                  subjectLabel = `${shortId(r.viewed_user_id)} (deleted user)`
                } else if (viewedListing) {
                  subjectLabel = viewedListing.address
                } else if (r.viewed_listing_id) {
                  subjectLabel = `${shortId(r.viewed_listing_id)} (deleted listing)`
                }
                return (
                  <tr
                    key={r.id}
                    className="border-b border-cream-200 last:border-b-0"
                  >
                    <td
                      className="py-2 px-3 align-top whitespace-nowrap text-navy-900/80"
                      title={new Date(r.accessed_at).toISOString()}
                    >
                      {relativeTime(r.accessed_at)}
                    </td>
                    <td className="py-2 px-3 align-top whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-navy-900/5 text-navy-900/80 font-mono">
                        {r.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 align-top text-navy-900/80">
                      {viewerLabel}
                    </td>
                    <td className="py-2 px-3 align-top text-navy-900/80">
                      {subjectLabel || (
                        <span className="text-navy-900/40">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 align-top">
                      {r.details ? (
                        <code className="text-[11px] text-navy-900/70 break-all">
                          {JSON.stringify(r.details)}
                        </code>
                      ) : (
                        <span className="text-navy-900/40">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
