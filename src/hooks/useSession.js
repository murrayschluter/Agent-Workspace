// src/hooks/useSession.js
// React hook returning the current Supabase session (or null) with live
// updates as the session changes.

import { useAuth } from '../contexts/AuthContext'

export function useSession() {
  const { session, loading, error } = useAuth()
  return { session, loading, error }
}
