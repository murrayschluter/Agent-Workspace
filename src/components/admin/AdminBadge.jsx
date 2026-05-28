// src/components/admin/AdminBadge.jsx
// "Admin" pill rendered in the dark navy Sidebar above ProfileMenu.
// Visible only to super_admins. Click opens the AdminPanel slide-in.

import { useState } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { useAdminOverride } from '../../contexts/AdminOverrideContext'
import AdminPanel from './AdminPanel'

export default function AdminBadge() {
  const { profile } = useProfile()
  const { enterAdminMode } = useAdminOverride()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  if (profile?.role !== 'super_admin') return null

  // Clicking the badge enters admin mode (which writes an audit log row
  // via the context). If the audit-log write fails, we surface the error
  // and keep the panel closed — fail-closed per spec.
  const handleOpen = async () => {
    setError(null)
    try {
      await enterAdminMode()
      setOpen(true)
    } catch (e) {
      setError(e?.message || 'Failed to enter admin mode')
    }
  }

  return (
    <>
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gold-400/10 text-gold-400 text-[11px] font-semibold uppercase tracking-wider hover:bg-gold-400/20 transition"
        >
          <span>Admin</span>
          <span aria-hidden="true" className="text-gold-400/70">{'›'}</span>
        </button>
        {error && (
          <p className="mt-2 text-[11px] text-red-300">{error}</p>
        )}
      </div>
      {open && <AdminPanel onClose={() => setOpen(false)} />}
    </>
  )
}
