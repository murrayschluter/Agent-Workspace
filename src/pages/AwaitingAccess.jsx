// src/pages/AwaitingAccess.jsx
// Shown to users whose profile.role = 'pending'. They've authenticated
// with Microsoft but a super_admin hasn't activated their account yet.

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useSession } from '../hooks/useSession';

export default function AwaitingAccess() {
  const { session, loading } = useSession();
  const [email, setEmail] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email);
    });
  }, []);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold text-navy-900 mb-2">Awaiting access</h1>
        <p className="text-sm text-slate-600 mb-2">
          Signed in as <strong>{email}</strong>.
        </p>
        <p className="text-sm text-slate-600 mb-6">
          Your account is pending approval from an admin. Ping Antony or Murray to activate it.
        </p>
        <button
          onClick={() => signOut().then(() => window.location.reload())}
          className="text-sm text-slate-500 hover:text-slate-800 underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
