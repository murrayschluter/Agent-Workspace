import { useState } from 'react'
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom'
import { useListing } from '../hooks/useListing'
import { useProfile } from '../hooks/useProfile'
import { deleteListing, updateListingStage } from '../lib/listings'
import PropertyInfo from '../components/detail/PropertyInfo'
import Notes from '../components/detail/Notes'
import StageProgression from '../components/detail/StageProgression'
import ConditionTracker from '../components/detail/ConditionTracker'
import WeeklyLog from '../components/detail/WeeklyLog'
import Documents from '../components/detail/Documents'
import Services from '../components/detail/Services'
import TouchpointHistory from '../components/detail/TouchpointHistory'
import ShareDialog from '../components/sharing/ShareDialog'
import { STAGE_LABELS } from '../lib/format'

export default function ListingDetail() {
  const { id } = useParams()
  const { listing, loading, error, refetch } = useListing(id)
  const outletCtx = useOutletContext()
  const dashboardRefetch = outletCtx?.refetch
  const [shareOpen, setShareOpen] = useState(false)

  const refetchAll = () => {
    refetch?.()
    dashboardRefetch?.()
  }

  if (loading) {
    return (
      <div className="max-w-7xl">
        <BackLink />
        <p className="mt-4 text-navy-900/60">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl">
        <BackLink />
        <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 p-4">
          <p className="text-sm text-rose-700 whitespace-pre-wrap">{error.message}</p>
          <button
            onClick={refetch}
            className="mt-3 text-sm px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="max-w-2xl">
        <BackLink />
        <p className="mt-4 text-navy-900/60">Listing not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl space-y-6">
      <header>
        <BackLink />
        <div className="mt-3 flex items-baseline gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold text-navy-900">{listing.address}</h1>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gold-500/15 text-gold-600 font-medium">
            {STAGE_LABELS[listing.stage]}
          </span>
          <button
            onClick={() => setShareOpen(true)}
            className="ml-auto text-sm px-3 py-1.5 rounded-md border border-cream-200 text-navy-900 hover:bg-cream-100"
          >
            Share
          </button>
        </div>
      </header>

      <StageProgression listing={listing} onUpdate={refetchAll} />
      <ConditionTracker listing={listing} onUpdate={refetchAll} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <PropertyInfo listing={listing} onUpdate={refetchAll} />
          <Notes listing={listing} onUpdate={refetchAll} />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <WeeklyLog listing={listing} onUpdate={refetchAll} />
          <Services listing={listing} onUpdate={refetchAll} />
          <Documents listing={listing} onUpdate={refetchAll} />
          <TouchpointHistory listing={listing} onUpdate={refetchAll} />
        </div>
      </div>

      <DangerZone listing={listing} onChanged={refetchAll} onDeleted={dashboardRefetch} />

      {shareOpen && (
        <ShareDialog
          listingId={listing.id}
          ownerId={listing.owner_id}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

// Permission-aware destructive action zone.
// - super_admin: hard Delete (matches RLS: only super_admin can DELETE listings).
// - everyone else: Archive (stage transition to 'archived'), per AGENTS.md
//   anti-leaver safety rule. The listing row is preserved.
function DangerZone({ listing, onChanged, onDeleted }) {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const isSuperAdmin = profile?.role === 'super_admin'
  const alreadyArchived = listing.stage === 'archived'

  async function handleDelete() {
    const msg = `Delete this listing?\n\n"${listing.address}"\n\nThis removes the listing AND all related data — contracts, weekly logs, touchpoints, stage history, documents. This cannot be undone.`
    if (!confirm(msg)) return
    try {
      setBusy(true)
      setError(null)
      await deleteListing(listing.id)
      onDeleted?.()
      navigate('/')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function handleArchive() {
    const msg = `Archive this listing?\n\n"${listing.address}"\n\nThe listing and all its data are preserved. A super_admin can restore or delete it later.`
    if (!confirm(msg)) return
    try {
      setBusy(true)
      setError(null)
      await updateListingStage(listing.id, 'archived')
      onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-12 pt-6 border-t border-cream-200">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-rose-700/70 mb-3">
        Danger zone
      </h3>
      <div className="flex items-center gap-4 flex-wrap">
        {isSuperAdmin ? (
          <>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="px-4 py-2 rounded-md border border-rose-300 text-rose-700 text-sm font-medium hover:bg-rose-50 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete this listing'}
            </button>
            <p className="text-xs text-navy-900/40 max-w-md">
              Removes the listing and all related data (contracts, weekly logs, touchpoints, documents, stage history).
            </p>
          </>
        ) : (
          <>
            <button
              onClick={handleArchive}
              disabled={busy || alreadyArchived}
              className="px-4 py-2 rounded-md border border-cream-200 text-navy-900 text-sm font-medium hover:bg-cream-100 disabled:opacity-50"
            >
              {busy ? 'Archiving…' : alreadyArchived ? 'Already archived' : 'Archive this listing'}
            </button>
            <p className="text-xs text-navy-900/40 max-w-md">
              Moves the listing to the archived stage. Data is preserved; only a super_admin can delete listings.
            </p>
          </>
        )}
      </div>
      {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/" className="text-sm text-navy-900/60 hover:text-gold-600">
      ← Dashboard
    </Link>
  )
}
