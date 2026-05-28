// src/components/auth/ProfileMenu.jsx
// Sidebar profile section with display name, email, role badge, and sign-out
// button. Rendered at the bottom of the dark navy Sidebar.

import { useState } from 'react';
import { useProfile } from '../../hooks/useProfile';
import { signOut } from '../../lib/auth';

const ROLE_LABELS = {
  super_admin: 'Admin',
  agent: 'Agent',
  pending: 'Pending',
};

export default function ProfileMenu() {
  const { profile, loading } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  if (loading || !profile) return null;

  const roleLabel = ROLE_LABELS[profile.role] || profile.role;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="px-4 py-4 border-t border-navy-800">
      <div className="text-sm font-medium text-cream-100 truncate">
        {profile.display_name || profile.email}
      </div>
      <div className="text-xs text-cream-100/60 mb-2 truncate">{profile.email}</div>
      <div className="inline-block text-[10px] uppercase tracking-wider bg-navy-800 text-gold-400 px-2 py-0.5 rounded mb-3">
        {roleLabel}
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="block text-xs text-cream-100/60 hover:text-cream-100 underline disabled:opacity-50 disabled:no-underline"
      >
        {signingOut ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  );
}
