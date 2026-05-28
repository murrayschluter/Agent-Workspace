// src/lib/auth.js
// Sign-in / sign-out wrappers. Centralises the OAuth options so callers
// don't need to know about provider config.

import { supabase } from './supabase';

export async function signInWithMicrosoft() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email openid profile',
      redirectTo: `${import.meta.env.VITE_SITE_URL}/`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}
