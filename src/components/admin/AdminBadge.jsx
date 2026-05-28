// src/components/admin/AdminBadge.jsx
// "Admin" pill rendered in the dark navy Sidebar above ProfileMenu.
// Visible only to super_admins. Click opens the AdminPanel slide-in.

import { useState } from 'react'
import { useProfile } from '../../hooks/useProfile'
import AdminPanel from './AdminPanel'

export default function AdminBadge() {
  const { profile } = useProfile()
  const [open, setOpen] = useState(false)

  if (profile?.role !== 'super_admin') return null

  return (
    <>
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gold-400/10 text-gold-400 text-[11px] font-semibold uppercase tracking-wider hover:bg-gold-400/20 transition"
        >
          <span>Admin</span>
          <span aria-hidden="true" className="text-gold-400/70">{'›'}</span>
        </button>
      </div>
      {open && <AdminPanel onClose={() => setOpen(false)} />}
    </>
  )
}
