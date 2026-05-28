// src/lib/auth.js
// Sign-in / sign-out wrappers. Centralises the OAuth options so callers
// don't need to know about provider config.

import { supabase } from './supabase';

export async function signInWithMicrosoft() {
  // Fall back to window.location.origin so OAuth round-trips work on
  // ephemeral Vercel preview deployments (which get per-deploy URLs not
  // known at build time). The Supabase URL allowlist still controls which
  // origins are actually permitted.
  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email openid profile',
      redirectTo: `${siteUrl}/`,
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
