import { useState } from 'react'
import {
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
  DOCUMENT_CATEGORIES,
} from '../../lib/documents'
import { formatRelativeDate } from '../../lib/format'
import Card from '../Card'

export default function Documents({ listing, onUpdate }) {
  const docs = (listing.documents ?? [])
    .slice()
    .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
  const [adding, setAdding] = useState(false)

  return (
    <Card title="Documents" right={
      !adding && (
        <button
          onClick={() => setAdding(true)}
          className="text-sm px-3 py-1.5 rounded-md border border-cream-200 text-navy-900 hover:border-gold-500/40 hover:text-gold-600"
        >
          + Upload
        </button>
      )
    }>
      {adding && (
        <UploadForm
          listingId={listing.id}
          onCancel={() => setAdding(false)}
          onUploaded={() => { setAdding(false); onUpdate?.() }}
        />
      )}

      {docs.length === 0 && !adding ? (
        <p className="text-sm text-navy-900/40 italic">
          No documents yet. Upload open home reports here so the AI can use them when generating touchpoints.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => <DocRow key={d.id} doc={d} onUpdate={onUpdate} />)}
        </ul>
      )}
    </Card>
  )
}

function DocRow({ doc, onUpdate }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleDelete() {
    if (!confirm(`Delete ${doc.filename}?`)) return
    try {
      setBusy(true)
      setError(null)
      await deleteDocument(doc)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <li>
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-cream-200 bg-cream-50/40 hover:bg-white transition">
        <div className="flex items-center gap-3 min-w-0">
          <DocIcon mimeType={doc.mime_type} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-navy-900 truncate">{doc.filename}</div>
            <div className="text-xs text-navy-900/50">
              <span className="text-gold-600 font-medium">{DOCUMENT_CATEGORIES[doc.category]}</span>
              <span className="mx-1.5 text-navy-900/30">·</span>
              {formatRelativeDate(doc.uploaded_at)}
              {doc.size_bytes != null && (
                <>
                  <span className="mx-1.5 text-navy-900/30">·</span>
                  {formatBytes(doc.size_bytes)}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={getDocumentUrl(doc.storage_path)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded text-navy-900/60 hover:text-gold-600"
          >
            Open
          </a>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-xs px-2 py-1 text-navy-900/40 hover:text-rose-600 disabled:opacity-50"
            aria-label="Delete"
          >
            {busy ? '…' : '✕'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-rose-600 mt-1 px-3">{error}</p>}
    </li>
  )
}

function DocIcon({ mimeType }) {
  const isPdf = mimeType?.includes('pdf')
  const isImg = mimeType?.startsWith('image/')
  return (
    <span className="text-base shrink-0 w-6 text-center" aria-hidden>
      {isPdf ? '📄' : isImg ? '🖼️' : '📎'}
    </span>
  )
}

function UploadForm({ listingId, onCancel, onUploaded }) {
  const [file, setFile] = useState(null)
  const [category, setCategory] = useState('open_home_report')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleUpload() {
    if (!file) {
      setError('Choose a file first.')
      return
    }
    try {
      setBusy(true)
      setError(null)
      await uploadDocument(listingId, file, category)
      onUploaded()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 pb-4 border-b border-cream-200 space-y-3">
      <div>
        <label className="block text-xs font-medium text-navy-900/70 mb-1">File</label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
          className="text-sm w-full file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-navy-900 file:text-cream-100 file:font-medium file:cursor-pointer file:hover:bg-navy-800"
        />
        {file && (
          <p className="text-xs text-navy-900/50 mt-1">
            Selected: {file.name} ({formatBytes(file.size)})
          </p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-navy-900/70 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={busy}
          className="input bg-white"
        >
          {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {category === 'open_home_report' && (
          <p className="text-[11px] text-gold-700/80 mt-1">
            Open Home Reports uploaded in the last 14 days are sent to Claude when generating touchpoints.
          </p>
        )}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={busy || !file}
          className="px-4 py-2 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-md text-navy-900/60 text-sm hover:text-navy-900"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function formatBytes(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
