// src/components/sharing/CollaboratorRow.jsx
// Single row inside ShareDialog showing a collaborator's name/email, their
// level, and (when canManage) a Remove button.

const LEVEL_LABELS = {
  viewer: 'Viewer',
  editor: 'Editor',
  co_owner: 'Co-owner',
}

export default function CollaboratorRow({ collaborator, canManage, onRemove, busy }) {
  const name =
    collaborator.profiles?.display_name || collaborator.profiles?.email || 'Unknown'

  return (
    <li className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-cream-100/60 text-sm">
      <span className="text-navy-900 truncate">{name}</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-600 font-medium">
          {LEVEL_LABELS[collaborator.level] || collaborator.level}
        </span>
        {canManage && (
          <button
            onClick={onRemove}
            disabled={busy}
            className="text-xs text-rose-700 hover:text-rose-900 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  )
}
