// api/log-admin-view.js
// Writes a row to admin_access_log on behalf of a super_admin acting in
// admin override mode. Authenticated via the caller's Supabase JWT; we
// deliberately use the anon key + the user's JWT (NOT the service role)
// so RLS enforces viewer_user_id = auth.uid() per the policy in
// supabase/auth/12_rls_admin_log.sql.

import { createClient } from '@supabase/supabase-js'

const ALLOWED_ACTIONS = new Set([
  'enter_admin_mode',
  'exit_admin_mode',
  'view_as',
  'view_listing',
  'admin_search',
  'delete_listing',
  'delete_child_record',
  'deactivate_user',
  'reassign_owner',
  'role_change',
])

function getEnv() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  return { url, anonKey }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST only' })
  }

  const authHeader = req.headers.authorization || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  const { action, viewed_user_id, viewed_listing_id, details } = req.body || {}
  if (!action || typeof action !== 'string' || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'Unknown or missing action' })
  }

  const { url, anonKey } = getEnv()
  if (!url || !anonKey) {
    return res.status(500).json({
      error:
        'Supabase env vars missing on server (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
    })
  }

  // Authenticate as the caller. Using the anon key + user JWT preserves RLS:
  // the insert policy must accept auth.uid() = viewer_user_id.
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid session' })
  }

  const { error: insertErr } = await supabase.from('admin_access_log').insert({
    viewer_user_id: user.id,
    viewed_user_id: viewed_user_id || null,
    viewed_listing_id: viewed_listing_id || null,
    action,
    details: details ?? null,
  })

  if (insertErr) {
    return res
      .status(500)
      .json({ error: 'Insert failed', detail: insertErr.message })
  }

  return res.status(200).json({ ok: true })
}
