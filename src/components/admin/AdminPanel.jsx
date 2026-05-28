// src/components/admin/AdminPanel.jsx
// Slide-in panel from the right with super_admin tools:
//   - View-as agent picker (populated from profiles)
//   - Link to admin audit log
//   - Link to user management
//
// The panel sits over the main app content (not inside the dark sidebar),
// so it uses the light cream / navy palette for legibility.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAdminOverride } from '../../contexts/AdminOverrideContext'

export default function AdminPanel({ onClose }) {
  const { viewAs } = useAdminOverride()
  const [agents, setAgents] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [agentsError, setAgentsError] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoadingAgents(true)
    supabase
      .from('profiles')
      .select('user_id, email, display_name, role')
      .in('role', ['agent', 'super_admin'])
      .order('email', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setAgentsError(error.message || 'Failed to load profiles')
        } else {
          setAgents(data || [])
        }
        setLoadingAgents(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleViewAs = async () => {
    if (!selectedUserId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await viewAs(selectedUserId)
      onClose()
    } catch (e) {
      setSubmitError(e?.message || 'Failed to start view-as session')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close admin panel"
        onClick={onClose}
        className="flex-1 bg-navy-950/50"
      />
      <aside className="w-96 max-w-[90vw] h-full bg-cream-50 text-navy-900 shadow-xl border-l border-cream-200 flex flex-col">
        <header className="px-6 py-5 border-b border-cream-200 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Admin tools</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-navy-900/60 hover:text-navy-900 underline"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-navy-900/60 mb-2">
              View as agent
            </h3>
            <p className="text-xs text-navy-900/70 mb-3">
              Temporarily browse the app as another agent. Every transition is recorded in the audit log.
            </p>
            {loadingAgents ? (
              <div className="text-sm text-navy-900/60">Loading agents...</div>
            ) : agentsError ? (
              <div className="text-sm text-red-700">{agentsError}</div>
            ) : (
              <>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={submitting}
                  className="input mb-3"
                >
                  <option value="">Select an agent...</option>
                  {agents.map((a) => (
                    <option key={a.user_id} value={a.user_id}>
                      {(a.display_name || a.email) +
                        (a.role === 'super_admin' ? ' (admin)' : '')}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleViewAs}
                  disabled={!selectedUserId || submitting}
                  className="w-full px-3 py-2 rounded-md bg-navy-900 text-cream-50 text-sm font-medium hover:bg-navy-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Starting...' : 'Start view-as'}
                </button>
                {submitError && (
                  <p className="mt-2 text-xs text-red-700">{submitError}</p>
                )}
              </>
            )}
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-wider text-navy-900/60 mb-2">
              Admin pages
            </h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  to="/admin/audit-log"
                  onClick={onClose}
                  className="block px-3 py-2 rounded-md hover:bg-cream-100 text-navy-900"
                >
                  Audit log
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/users"
                  onClick={onClose}
                  className="block px-3 py-2 rounded-md hover:bg-cream-100 text-navy-900"
                >
                  User management
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  )
}
