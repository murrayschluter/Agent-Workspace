// Front-end wrapper around /api/send-touchpoint.
// Recipients are derived server-side from the listing record (so the endpoint
// can't be used to message arbitrary numbers); we only send the touchpoint id,
// channel, and content, plus the signed-in user's token for authentication.
import { supabase } from './supabase'

export async function sendTouchpoint({ touchpointId, channel, content }) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('You must be signed in to send.')

  const res = await fetch('/api/send-touchpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ touchpointId, channel, content }),
  })

  if (!res.ok) {
    let msg
    try {
      const err = await res.json()
      msg = err.error || `HTTP ${res.status}`
    } catch {
      msg = `HTTP ${res.status}`
    }
    throw new Error(msg)
  }

  return res.json()
}
