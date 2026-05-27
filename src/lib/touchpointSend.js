// Front-end wrapper around /api/send-touchpoint.
// Returns the parsed JSON or throws with a useful error message.
export async function sendTouchpoint({ touchpointId, channel, content, recipients }) {
  const res = await fetch('/api/send-touchpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ touchpointId, channel, content, recipients }),
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
