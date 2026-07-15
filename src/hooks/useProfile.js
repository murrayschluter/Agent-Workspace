// src/hooks/useProfile.js
// Returns the current user's profile row from the profiles table, including role.
// Returns { profile, loading, error }. profile is null while loading.

import { useAuth } from '../contexts/AuthContext'

export function useProfile() {
  const { profile, loading, error, retryProfile } = useAuth()
  return { profile, loading, error, refetch: retryProfile }
}
