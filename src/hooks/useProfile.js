// src/hooks/useProfile.js
// Returns the current user's profile row from the profiles table, including role.
// Returns { profile, loading, error }. profile is null while loading.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from './useSession';

export function useProfile() {
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('profiles')
      .select('user_id, email, display_name, role, vault_user_id')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error);
        else setProfile(data);
        setLoading(false);
      });
  }, [session, sessionLoading]);

  return { profile, loading: sessionLoading || loading, error };
}
