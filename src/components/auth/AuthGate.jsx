// src/components/auth/AuthGate.jsx
// Wraps any route that requires an authenticated session. If no session,
// redirect to /login. While loading, show a spinner.

import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';

export default function AuthGate({ children }) {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
