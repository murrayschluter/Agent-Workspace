// src/components/auth/AuthGate.jsx
// Wraps any route that requires an authenticated AND activated user.
// - No session                       -> /login
// - No profile row OR role = pending -> /awaiting-access
// - role = agent/super_admin         -> children
//
// Note on the "no profile" case: the on_auth_user_created trigger should
// create a profile row on first sign-in. If it didn't (e.g. the trigger
// wasn't deployed yet when this session was established), treat the user
// as pending so they see the awaiting-access screen instead of crashing
// on missing profile data. The trigger will create a row on the next
// sign-in.

import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useProfile } from '../../hooks/useProfile';

export default function AuthGate({ children }) {
  const { session, loading } = useSession()
  const { profile, error, refetch } = useProfile()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-rose-300 bg-rose-50 p-5">
          <h1 className="font-semibold text-rose-900">Couldn't verify your access</h1>
          <p className="mt-2 text-sm text-rose-700">
            Your account is signed in, but the workspace couldn't load your access profile.
          </p>
          <button
            type="button"
            onClick={refetch}
            className="mt-4 rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If we have a session but no profile row, treat as pending (the trigger
  // should create one on next sign-in; until then, show awaiting-access).
  if (!profile || profile.role === 'pending') {
    return <Navigate to="/awaiting-access" replace />;
  }

  return children;
}
