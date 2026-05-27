import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_BASE = `You are writing on behalf of Murray, a real estate agent at Blac Property Group in Moreton Bay / Narangba, Queensland, Australia.

VOICE GUIDELINES (critical, never violate):
- Warm, plain-spoken, conversational
- NEVER use em dashes (—). Use commas, semicolons, or short sentences instead.
- No corporate fluff, no marketing speak, no jargon
- Sound like a trusted agent checking in, not a marketing department
- Australian English spelling and idiom (where natural, not forced)
- Address vendors by first name only
- Be specific with numbers and facts when they are provided
- Never invent details. Only use what is in the context. If you don't have a fact, leave it out rather than make something up.`

const SYSTEM_PROMPTS = {
  monday_report: `${SYSTEM_BASE}

You are writing the MONDAY VENDOR REPORT email. Murray will call the vendor on Tuesday to discuss this. The email plants the agenda for that call, it doesn't replace the conversation.

EMAIL STRUCTURE:
1. Subject line on first line: "Subject: ..."
2. Blank line
3. Greeting by first name(s)
4. Open home summary (attendance, enquiry count, inspection count)
5. Price feedback from buyers, if known
6. Overall sentiment and where things are at
7. What you're doing this week, what comes next
8. Warm close, mentioning you will call tomorrow to chat properly
9. Sign off: "Cheers,\\nMurray"

Length: 8 to 15 sentences in the body.

If open home reports are attached, use the specific details from them (buyer names mentioned, specific feedback, attendance numbers, particular comments) to make the email concrete. Don't just restate the weekly log numbers if the report has richer detail.

EXAMPLE (this is the tone and structure to match):

Subject: Weekend wrap and where we're sitting

Hi Michael,

Quick wrap on the weekend. Had 4 groups through the Saturday open and 6 enquiries come through over the weekend, off the back of the photos going live earlier in the week. Two parties asked about finance options, both still doing their homework but the level of interest feels genuine.

Feedback on price is sitting around the $920k mark from what buyers are saying. That's a touch below where we listed but still in the ballpark.

The plan this week is to follow up with the two finance-curious buyers and stay close to the agent network in case anything else comes through. Will call you tomorrow morning to chat it through properly.

Cheers,
Murray`,

  wednesday_sms: `${SYSTEM_BASE}

You are writing a WEDNESDAY SMS to the vendor. Short, casual, conversational. A quick check-in from a trusted agent.

CONSTRAINTS:
- 2 to 4 sentences MAXIMUM
- Pull from the weekly log if anything notable happened (enquiries, interest, follow-ups)
- Sounds like a quick text, not a corporate update
- NO subject line, this is an SMS
- No sign-off needed (it's already from Murray's phone)

EXAMPLE:

Hi Michael, quick update. Had two good follow-up calls today, one party coming back for a second look Saturday morning. Will keep you posted.`,

  friday_sms: `${SYSTEM_BASE}

You are writing a FRIDAY SMS to the vendor. End-of-week framing. Can reference the upcoming weekend open if applicable, or summarise the week's activity. Upbeat, momentum-building.

CONSTRAINTS:
- 2 to 4 sentences MAXIMUM
- NO subject line, this is an SMS
- Mention the weekend ahead if there's an open home
- No sign-off needed

EXAMPLE:

Hi Michael, hope you've had a good week. Open home is booked 11-11:30 tomorrow, three groups confirmed already plus the second-look from earlier in the week. Chat Monday with the wrap.`,
}

const MAX_TOKENS = {
  monday_report:  1500,
  wednesday_sms:  300,
  friday_sms:     300,
}

const BUCKET = 'listing-documents'

// Lazy Supabase client for the API handler (reads via anon key).
function getStorageClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase env vars missing on server (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }
  return createClient(url, key)
}

async function fetchDocumentBase64(supabase, storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) throw new Error(`Failed to download ${storagePath}: ${error.message}`)
  const buffer = await data.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is missing from .env. Get one at https://console.anthropic.com/settings/keys, add it to your .env file, then restart the dev server.',
    })
  }

  const { type, listing, weeklyLog, previousTouchpoint, documents = [] } = req.body ?? {}

  if (!type || !SYSTEM_PROMPTS[type]) {
    return res.status(400).json({ error: `Unknown touchpoint type: ${type}` })
  }
  if (!listing) {
    return res.status(400).json({ error: 'Missing listing context' })
  }

  try {
    // Fetch any attached documents from Supabase Storage as base64.
    // Only PDFs are sent to Claude (image support could be added later).
    const docBlocks = []
    if (documents.length > 0) {
      const storage = getStorageClient()
      for (const doc of documents) {
        if (!doc.mime_type?.includes('pdf')) continue
        try {
          const base64 = await fetchDocumentBase64(storage, doc.storage_path)
          docBlocks.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
            title: doc.filename,
            context: `Open home report uploaded ${doc.uploaded_at?.split('T')[0] || 'recently'}.`,
            citations: { enabled: false },
          })
        } catch (e) {
          console.warn(`[generate-touchpoint] doc fetch failed for ${doc.filename}:`, e.message)
        }
      }
    }

    const userText = buildUserPrompt({ listing, weeklyLog, previousTouchpoint, type, docCount: docBlocks.length })

    // Document blocks first, then the instruction text
    const messageContent = [...docBlocks, { type: 'text', text: userText }]

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: MAX_TOKENS[type],
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPTS[type],
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    return res.status(200).json({
      content: text,
      usage: response.usage,
      docs_used: docBlocks.length,
    })
  } catch (e) {
    console.error('[generate-touchpoint] error:', e)
    return res.status(500).json({
      error: e.message || 'Internal error',
      type: e?.constructor?.name,
    })
  }
}

function buildUserPrompt({ listing, weeklyLog, previousTouchpoint, type, docCount }) {
  const firstNames = (listing.vendor_names ?? [])
    .map((n) => (n || '').split(' ')[0])
    .filter(Boolean)

  const vendors =
    firstNames.length === 0 ? 'there' :
    firstNames.length === 1 ? firstNames[0] :
    firstNames.length === 2 ? `${firstNames[0]} and ${firstNames[1]}` :
    `${firstNames.slice(0, -1).join(', ')}, and ${firstNames[firstNames.length - 1]}`

  const dom = calculateDOM(listing.list_date)

  const parts = []
  parts.push(`Generate a ${type.replace(/_/g, ' ')} for the following listing.`)
  parts.push('')

  if (docCount > 0) {
    parts.push(`Above this prompt: ${docCount} open home report PDF${docCount > 1 ? 's' : ''} from the last 14 days. Read carefully and use specific details from them in the message — buyer names mentioned, particular feedback quotes, attendance breakdowns, anything that makes this report feel grounded in real events rather than generic.`)
    parts.push('')
  }

  parts.push(`Property address: ${listing.address}`)
  parts.push(`Vendor first name(s) to use in greeting: ${vendors}`)
  parts.push(`Days on market: ${dom}`)
  parts.push(`Campaign type: ${listing.campaign_type || 'private treaty'}`)

  if (weeklyLog) {
    parts.push('')
    parts.push(`Most recent weekly activity log (week ending ${weeklyLog.week_ending}):`)
    parts.push(`- Enquiries: ${weeklyLog.enquiry_count ?? 0}`)
    parts.push(`- Inspections: ${weeklyLog.inspection_count ?? 0}`)
    parts.push(`- Open home groups: ${weeklyLog.open_home_groups ?? 0}`)
    if (weeklyLog.offers_received) {
      const amt = weeklyLog.offer_amount
        ? `$${Number(weeklyLog.offer_amount).toLocaleString()}`
        : 'yes (amount not specified)'
      parts.push(`- Offer received: ${amt}`)
    }
    if (weeklyLog.price_feedback) {
      parts.push(`- Price feedback from buyers: ${weeklyLog.price_feedback}`)
    }
    if (weeklyLog.notes) {
      parts.push(`- Murray's internal notes: ${weeklyLog.notes}`)
    }
  } else if (docCount === 0) {
    parts.push('')
    parts.push('No weekly activity log entry yet. Keep the message short and acknowledge it is early in the campaign.')
  }

  if (previousTouchpoint?.generated_content) {
    parts.push('')
    parts.push('This is a regeneration. The previous draft was:')
    parts.push('"""')
    parts.push(previousTouchpoint.generated_content)
    parts.push('"""')
    parts.push('Generate a different angle or wording. Same facts, fresh take.')
  }

  return parts.join('\n')
}

function calculateDOM(listDate) {
  if (!listDate) return 0
  const days = Math.floor((Date.now() - new Date(listDate).getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
}
