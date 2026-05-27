import { useState } from 'react'
import { updateListingStage, markListingFellOver } from '../../lib/listings'
import { createContract } from '../../lib/contracts'
import { STAGE_LABELS, formatDateTime } from '../../lib/format'
import Card from '../Card'
import ContractModal from './ContractModal'

const NORMAL_STAGES   = ['listed', 'photos_taken', 'launched_online', 'under_contract', 'unconditional', 'settlement', 'archived']
const TENANTED_STAGES = ['listed', 'photos_taken', 'tenants_contacted', 'launched_online', 'under_contract', 'unconditional', 'settlement', 'archived']
const FELL_OVER_ELIGIBLE = ['under_contract', 'unconditional', 'settlement']

function stagesFor(isTenanted) {
  return isTenanted ? TENANTED_STAGES : NORMAL_STAGES
}

export default function StageProgression({ listing, onUpdate }) {
  const [busy, setBusy] = useState(false)
  const [confirmFellOver, setConfirmFellOver] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [error, setError] = useState(null)

  const seq = stagesFor(listing.is_tenanted)
  const currentIdx = seq.indexOf(listing.stage)
  const next = currentIdx >= 0 ? seq[currentIdx + 1] : null
  const showFellOver = FELL_OVER_ELIGIBLE.includes(listing.stage)
  const requiresContractModal = next === 'under_contract'

  const sortedHistory = [...(listing.stage_history ?? [])]
    .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))

  async function handleAdvance() {
    if (!next || requiresContractModal) return
    try {
      setBusy(true)
      setError(null)
      await updateListingStage(listing.id, next)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleFellOver() {
    try {
      setBusy(true)
      setError(null)
      await markListingFellOver(listing.id)
      setConfirmFellOver(false)
      onUpdate?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // ContractModal calls this with the form data on Save.
  // Order matters: create contract first (succeeds with stage still launched_online),
  // then advance stage. If the stage update fails, the contract still exists and the
  // user can retry via Supabase Table Editor — much less bad than the inverse.
  async function handleCreateContract(contractData) {
    await createContract(listing.id, contractData)
    await updateListingStage(listing.id, 'under_contract')
    onUpdate?.()
  }

  return (
    <Card title="Stage">
      <div className="space-y-5">
        <div className="flex items-center gap-1 flex-wrap">
          {seq.map((s, i) => {
            const isPast = i < currentIdx
            const isCurrent = i === currentIdx
            return (
              <span key={s} className="flex items-center gap-1">
                <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                  isCurrent ? 'bg-gold-500 text-navy-950 font-medium' :
                  isPast ?    'bg-navy-900 text-cream-100' :
                              'bg-navy-900/5 text-navy-900/40'
                }`}>
                  {STAGE_LABELS[s]}
                </span>
                {i < seq.length - 1 && <span className="text-navy-900/20 text-xs">›</span>}
              </span>
            )
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {next ? (
            <button
              onClick={requiresContractModal ? () => setShowContractModal(true) : handleAdvance}
              disabled={busy}
              className="px-4 py-2 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
            >
              {busy ? 'Working…' : `Move to ${STAGE_LABELS[next]}`}
            </button>
          ) : (
            <span className="text-sm text-navy-900/40 italic">Terminal stage reached.</span>
          )}

          {showFellOver && !confirmFellOver && (
            <button
              onClick={() => setConfirmFellOver(true)}
              disabled={busy}
              className="px-4 py-2 rounded-md border border-rose-300 text-rose-700 text-sm font-medium hover:bg-rose-50"
            >
              Listing Fell Over
            </button>
          )}
          {showFellOver && confirmFellOver && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-rose-50 border border-rose-300">
              <span className="text-sm text-rose-800">
                Revert to On the Market and mark contract as fallen over?
              </span>
              <button
                onClick={handleFellOver}
                disabled={busy}
                className="px-3 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-50"
              >
                Yes, fell over
              </button>
              <button
                onClick={() => setConfirmFellOver(false)}
                disabled={busy}
                className="px-3 py-1 text-rose-700 text-xs hover:text-rose-900"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {sortedHistory.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-navy-900/60 hover:text-navy-900 select-none">
              Stage history ({sortedHistory.length})
            </summary>
            <ul className="mt-3 space-y-1.5 border-l-2 border-cream-200 pl-4">
              {sortedHistory.map((h) => {
                const isFellOver = h.from_stage &&
                  FELL_OVER_ELIGIBLE.includes(h.from_stage) &&
                  h.to_stage === 'launched_online'
                return (
                  <li key={h.id} className="text-xs text-navy-900/70">
                    <span className="text-navy-900/40">{formatDateTime(h.changed_at)}</span>
                    {' — '}
                    {h.from_stage ? (
                      <>
                        {STAGE_LABELS[h.from_stage]} →{' '}
                        <span className="text-navy-900 font-medium">{STAGE_LABELS[h.to_stage]}</span>
                        {isFellOver && (
                          <span className="ml-2 text-rose-600 text-[10px] font-semibold uppercase tracking-wider">
                            Fell Over
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        Listing created →{' '}
                        <span className="text-navy-900 font-medium">{STAGE_LABELS[h.to_stage]}</span>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </details>
        )}
      </div>

      <ContractModal
        isOpen={showContractModal}
        onClose={() => setShowContractModal(false)}
        onSave={handleCreateContract}
      />
    </Card>
  )
}
