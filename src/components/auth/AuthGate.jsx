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
  const { session, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();

  if (sessionLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
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
