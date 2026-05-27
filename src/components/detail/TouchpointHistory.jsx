import { useState } from 'react'
import {
  createTouchpoint,
  updateTouchpoint,
  markTouchpointSent,
  deleteTouchpoint,
} from '../../lib/touchpoints'
import { generateTouchpoint } from '../../lib/touchpointAI'
import { sendTouchpoint } from '../../lib/touchpointSend'
import { TOUCHPOINT_LABELS, formatRelativeDate } from '../../lib/format'
import Card from '../Card'

const ALL_TYPES = ['monday_report', 'wednesday_sms', 'friday_sms']
const DOC_RECENCY_DAYS = 14

function recentOpenHomeReports(documents) {
  const cutoff = Date.now() - DOC_RECENCY_DAYS * 24 * 60 * 60 * 1000
  return (documents ?? [])
    .filter((d) => d.category === 'open_home_report')
    .filter((d) => new Date(d.uploaded_at).getTime() >= cutoff)
}

export default function TouchpointHistory({ listing, onUpdate }) {
  const all = (listing.touchpoints ?? [])
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const drafts = all.filter((t) => !t.sent_at)
  const sent = all.filter((t) => t.sent_at)

  const latestLog =
    (listing.weekly_logs ?? [])
      .slice()
      .sort((a, b) => new Date(b.week_ending) - new Date(a.week_ending))[0] ?? null

  const reportsForAi = recentOpenHomeReports(listing.documents)

  const [generatingType, setGeneratingType] = useState(null)
  const [error, setError] = useState(null)

  async function handleGenerate(type) {
    try {
      setGeneratingType(type)
      setError(null)
      const content = await generateTouchpoint({
        type,
        listing,
        weeklyLog: latestLog,
        documents: reportsForAi,
      })
      await createTouchpoint(listing.id, type, content)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setGeneratingType(null)
    }
  }

  return (
    <Card
      title="Touchpoints"
      right={
        <div className="flex items-center gap-1.5 flex-wrap">
          {ALL_TYPES.map((type) => (
            <GenerateButton
              key={type}
              type={type}
              generating={generatingType === type}
              disabled={generatingType !== null}
              onClick={() => handleGenerate(type)}
            />
          ))}
        </div>
      }
    >
      {reportsForAi.length > 0 && (
        <p className="mb-3 text-[11px] text-gold-700 bg-gold-500/5 border border-gold-500/20 rounded px-3 py-1.5">
          {reportsForAi.length} open home report{reportsForAi.length > 1 ? 's' : ''} from the last {DOC_RECENCY_DAYS} days will be attached to the prompt.
        </p>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {all.length === 0 && !generatingType && (
        <p className="text-sm text-navy-900/40 italic">
          No touchpoints yet. Click a button above to generate one.
        </p>
      )}

      <ul className="space-y-3">
        {drafts.map((t) => (
          <DraftTouchpoint
            key={t.id}
            t={t}
            listing={listing}
            latestLog={latestLog}
            reportsForAi={reportsForAi}
            onUpdate={onUpdate}
          />
        ))}
        {sent.map((t) => (
          <SentTouchpoint key={t.id} t={t} />
        ))}
      </ul>
    </Card>
  )
}

function GenerateButton({ type, generating, disabled, onClick }) {
  const short =
    type === 'monday_report'  ? 'Mon Report' :
    type === 'wednesday_sms'  ? 'Wed SMS' :
                                'Fri SMS'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-2.5 py-1 rounded border border-cream-200 text-navy-900 hover:border-gold-500/50 hover:text-gold-600 disabled:opacity-50"
    >
      {generating ? 'Generating…' : `+ ${short}`}
    </button>
  )
}

function DraftTouchpoint({ t, listing, latestLog, reportsForAi, onUpdate }) {
  const [content, setContent] = useState(t.generated_content)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const isEmail = t.type === 'monday_report'
  const channel = isEmail ? 'email' : 'sms'
  const recipients = isEmail ? listing.vendor_emails : listing.vendor_phones
  const recipientCount = recipients?.length ?? 0
  const recipientLabel = recipientCount === 0
    ? `No vendor ${isEmail ? 'email' : 'phone'} on file`
    : recipientCount === 1 ? recipients[0] : `${recipientCount} recipients`

  async function handleSend() {
    try {
      setBusy(true)
      setError(null)
      await sendTouchpoint({
        touchpointId: t.id,
        channel,
        content,
        recipients,
      })
      onUpdate?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkSent() {
    try {
      setBusy(true)
      setError(null)
      await markTouchpointSent(t.id, content)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate() {
    try {
      setBusy(true)
      setError(null)
      const newContent = await generateTouchpoint({
        type: t.type,
        listing,
        weeklyLog: latestLog,
        documents: reportsForAi,
        previousTouchpoint: { generated_content: content },
      })
      setContent(newContent)
      await updateTouchpoint(t.id, { generated_content: newContent })
      onUpdate?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDiscard() {
    if (!confirm('Discard this draft?')) return
    try {
      setBusy(true)
      await deleteTouchpoint(t.id)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const rows = isEmail ? 14 : 4

  return (
    <li className="border-2 border-gold-500/50 rounded-md p-4 bg-gold-500/5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-navy-900">
            {TOUCHPOINT_LABELS[t.type]}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-700 font-medium">
            Draft
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={busy}
            className="text-xs px-2.5 py-1 rounded border border-cream-200 text-navy-900/70 hover:text-navy-900 hover:border-gold-500/50 disabled:opacity-50"
          >
            {busy ? '…' : 'Regenerate'}
          </button>
          <button
            onClick={handleDiscard}
            disabled={busy}
            className="text-xs px-2.5 py-1 text-rose-700 hover:text-rose-900 disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={busy}
        rows={rows}
        className="w-full px-3 py-2 border border-cream-200 rounded text-sm text-navy-900 focus:outline-none focus:border-gold-500 resize-y bg-white"
      />

      {error && <p className="text-xs text-rose-600 mt-2 whitespace-pre-wrap">{error}</p>}

      <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            disabled={busy}
            className="text-xs px-2 py-1 text-navy-900/60 hover:text-navy-900"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <span className="text-[11px] text-navy-900/40">
            → {recipientLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isEmail ? (
            // Monday Report — copy/paste into email client, then mark sent
            <button
              onClick={handleMarkSent}
              disabled={busy}
              className="text-sm px-4 py-1.5 rounded-md bg-navy-900 text-cream-100 font-medium hover:bg-navy-800 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Mark as sent'}
            </button>
          ) : (
            <>
              <button
                onClick={handleMarkSent}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-md border border-cream-200 text-navy-900/70 hover:text-navy-900 disabled:opacity-50"
                title="Record as sent without actually sending (use if you sent through another channel)"
              >
                Mark sent only
              </button>
              <button
                onClick={handleSend}
                disabled={busy || recipientCount === 0}
                className="text-sm px-4 py-1.5 rounded-md bg-gold-500 text-navy-950 font-medium hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed"
                title={recipientCount === 0
                  ? 'No vendor phone on file'
                  : 'Send SMS via ClickSend, mark sent'}
              >
                {busy ? 'Sending…' : 'Send SMS'}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

function SentTouchpoint({ t }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(t.generated_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const content = t.generated_content ?? ''
  const showExpand = content.length > 200

  return (
    <li className="border border-cream-200 rounded-md p-4 bg-cream-50/40">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-navy-900">{TOUCHPOINT_LABELS[t.type]}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
            Sent {formatRelativeDate(t.sent_at)}
          </span>
        </div>
        <button
          onClick={copy}
          className="text-xs px-2 py-1 text-navy-900/60 hover:text-navy-900"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className={`text-sm text-navy-900/80 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
        {content}
      </div>
      {showExpand && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-gold-600 hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </li>
  )
}
