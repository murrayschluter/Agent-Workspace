import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

// Email subject pattern: Monday Reports start with "Subject: ..." on line 1.
function extractSubjectAndBody(content) {
  const lines = content.split('\n')
  const first = (lines[0] || '').trim()
  if (first.toLowerCase().startsWith('subject:')) {
    return {
      subject: first.replace(/^subject:\s*/i, '').trim(),
      body: lines.slice(1).join('\n').trimStart(),
    }
  }
  return { subject: 'Update on your property', body: content }
}

// Coerce Australian phone formats to E.164 (+61...). Handles common variants:
//   0400 000 000 -> +61400000000
//   04 0000 0000 -> +61400000000
//   +61 400 000 000 -> +61400000000
//   400000000 -> +61400000000 (bare 9-digit mobile)
function toE164(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('61')) return `+${digits}`
  if (digits.startsWith('04') && digits.length === 10) return `+61${digits.slice(1)}`
  if (digits.startsWith('4') && digits.length === 9) return `+61${digits}`
  // Already-prefixed or unrecognised — pass through with leading + if missing
  return phone.toString().startsWith('+') ? phone : `+${digits}`
}

async function sendEmail({ subject, body, recipients, from, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY missing from .env')
  if (recipients.length === 0) throw new Error('No vendor email on file for this listing')

  const resend = new Resend(apiKey)
  const result = await resend.emails.send({
    from,
    to: recipients,
    reply_to: replyTo || undefined,
    subject,
    text: body,
  })
  if (result.error) throw new Error(result.error.message || String(result.error))
  return { provider: 'resend', id: result.data?.id }
}

async function sendSms({ body, recipients, senderName }) {
  const username = process.env.CLICKSEND_USERNAME
  const apiKey = process.env.CLICKSEND_API_KEY
  if (!username || !apiKey) {
    throw new Error('CLICKSEND_USERNAME / CLICKSEND_API_KEY missing from .env')
  }
  if (recipients.length === 0) throw new Error('No vendor phone on file for this listing')

  const auth = Buffer.from(`${username}:${apiKey}`).toString('base64')
  const messages = recipients.map((to) => ({
    source: 'listing-portal',
    from: senderName,
    to,
    body,
  }))

  const res = await fetch('https://rest.clicksend.com/v3/sms/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.response_code !== 'SUCCESS') {
    const detail =
      data?.response_msg ||
      data?.data?.messages?.[0]?.status ||
      `HTTP ${res.status}`
    throw new Error(`ClickSend error: ${detail}`)
  }
  return { provider: 'clicksend', messages: data.data?.messages }
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing on server.')
  return createClient(url, key)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    touchpointId,
    channel, // 'email' | 'sms'
    content,
    recipients, // array: emails or phones
  } = req.body ?? {}

  if (!touchpointId) return res.status(400).json({ error: 'touchpointId required' })
  if (!channel) return res.status(400).json({ error: 'channel required' })
  if (!content) return res.status(400).json({ error: 'content required' })
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'recipients required' })
  }

  try {
    let result
    if (channel === 'email') {
      const { subject, body } = extractSubjectAndBody(content)
      const senderEmail = process.env.SENDER_EMAIL || 'onboarding@resend.dev'
      const senderName = process.env.SENDER_NAME || 'Murray'
      const fromHeader = `${senderName} <${senderEmail}>`
      result = await sendEmail({
        subject,
        body,
        recipients,
        from: fromHeader,
        replyTo: process.env.REPLY_TO_EMAIL,
      })
    } else if (channel === 'sms') {
      // Sender can be either alphanumeric (max 11 chars in AU) OR a mobile number.
      // Alphanumeric: truncate to 11 chars. Numeric: format to E.164 so ClickSend accepts.
      const rawSender = process.env.SMS_SENDER_NAME || 'Murray'
      const senderName = /[a-zA-Z]/.test(rawSender)
        ? rawSender.slice(0, 11)
        : (toE164(rawSender) || rawSender)
      const phones = recipients.map(toE164).filter(Boolean)
      if (phones.length === 0) {
        return res.status(400).json({ error: 'No valid mobile numbers after formatting' })
      }
      result = await sendSms({ body: content, recipients: phones, senderName })
    } else {
      return res.status(400).json({ error: `Unknown channel: ${channel}` })
    }

    // Mark touchpoint as sent (and persist the final content the user actually sent)
    const supabase = getSupabase()
    const { error: updateError } = await supabase
      .from('touchpoints')
      .update({
        sent_at: new Date().toISOString(),
        generated_content: content,
      })
      .eq('id', touchpointId)

    if (updateError) {
      // Send succeeded but DB update failed — surface as a partial-success so
      // the user knows to manually mark sent if they want.
      console.error('[send-touchpoint] DB update failed after successful send:', updateError)
      return res.status(200).json({
        sent: true,
        provider: result.provider,
        warning: `Send succeeded but failed to mark as sent in DB: ${updateError.message}`,
      })
    }

    return res.status(200).json({ sent: true, ...result })
  } catch (e) {
    console.error('[send-touchpoint] error:', e)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
