import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { updateContractConditions } from '../lib/contracts'
import {
  createCustomTask,
  completeCustomTask,
  snoozeCustomTask,
  deleteCustomTask,
} from '../lib/customTasks'
import { useCustomTasks } from '../hooks/useCustomTasks'
import {
  CONDITION_LABELS,
  TOUCHPOINT_LABELS,
  daysUntil,
  addDaysToDateStr,
  todayDateStr,
} from '../lib/format'
import Card from './Card'

export default function TodayTasks({ listings, onUpdate }) {
  const { tasks: allCustomTasks, refetch: refetchCustom } = useCustomTasks()

  const derived = useMemo(() => buildDerivedTasks(listings), [listings])
  const customTasksDue = useMemo(
    () => allCustomTasks.filter((t) => daysUntil(t.due_date) <= 0),
    [allCustomTasks]
  )
  const totalCount = derived.length + customTasksDue.length
  const overdueCount =
    derived.filter((t) => t.urgency === 'overdue').length +
    customTasksDue.filter((t) => daysUntil(t.due_date) < 0).length

  const [busyId, setBusyId] = useState(null)
  const [extendingId, setExtendingId] = useState(null)
  const [extendDays, setExtendDays] = useState(7)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  async function run(action, id) {
    try {
      setBusyId(id)
      setError(null)
      await action()
      onUpdate?.()
      refetchCustom()
      setExtendingId(null)
      setExtendDays(7)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function addTask({ title, due_date, listing_id }) {
    await createCustomTask({ title, due_date, listing_id })
    refetchCustom()
    setAdding(false)
  }

  const conditionTasks = derived.filter((t) => t.type === 'condition')
  const touchpointTasks = derived.filter((t) => t.type === 'touchpoint')

  const headerRight = (
    <div className="flex items-center gap-2">
      {totalCount > 0 && (
        <>
          {overdueCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
              {overdueCount} overdue
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-cream-100 text-navy-900/70 font-medium tabular-nums">
            {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
          </span>
        </>
      )}
      {totalCount === 0 && (
        <span className="text-xs text-navy-900/40">{todayLabel()}</span>
      )}
      <button
        onClick={() => setAdding(true)}
        className="text-xs px-2 py-1 rounded border border-cream-200 text-navy-900 hover:border-gold-500/50 hover:text-gold-600"
      >
        + Add task
      </button>
    </div>
  )

  return (
    <Card title="Today" right={headerRight}>
      {adding && (
        <AddTaskForm
          listings={listings}
          onAdd={addTask}
          onCancel={() => setAdding(false)}
        />
      )}

      {totalCount === 0 && !adding ? (
        <p className="text-sm text-navy-900/50 italic">Nothing due today. Nice work.</p>
      ) : (
        <div className="space-y-5">
          {conditionTasks.length > 0 && (
            <TaskGroup heading="Conditions">
              {conditionTasks.map((t) => (
                <ConditionTaskRow
                  key={t.id}
                  task={t}
                  busy={busyId === t.id}
                  isExtending={extendingId === t.id}
                  extendDays={extendDays}
                  onExtendDaysChange={setExtendDays}
                  onStartExtend={() => { setExtendingId(t.id); setExtendDays(7) }}
                  onConfirmExtend={() => run(() => t.onExtend(extendDays), t.id)}
                  onCancelExtend={() => setExtendingId(null)}
                  onComplete={() => run(t.onComplete, t.id)}
                />
              ))}
            </TaskGroup>
          )}

          {touchpointTasks.length > 0 && (
            <TaskGroup heading="Touchpoints">
              {touchpointTasks.map((t) => (
                <TouchpointTaskRow key={t.id} task={t} />
              ))}
            </TaskGroup>
          )}

          {customTasksDue.length > 0 && (
            <TaskGroup heading="To-do">
              {customTasksDue.map((t) => (
                <CustomTaskRow
                  key={t.id}
                  task={t}
                  busy={busyId === t.id}
                  onComplete={() => run(() => completeCustomTask(t.id), t.id)}
                  onSnooze={(days) =>
                    run(() => snoozeCustomTask(t.id, addDaysToDateStr(todayDateStr(), days)), t.id)
                  }
                  onDelete={() => run(() => deleteCustomTask(t.id), t.id)}
                />
              ))}
            </TaskGroup>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </Card>
  )
}

function TaskGroup({ heading, children }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-navy-900/50 mb-2">
        {heading}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function ConditionTaskRow({
  task, busy, isExtending, extendDays, onExtendDaysChange,
  onStartExtend, onConfirmExtend, onCancelExtend, onComplete,
}) {
  const styles = task.urgency === 'overdue'
    ? 'bg-rose-50 border-rose-200'
    : 'bg-amber-50 border-amber-200'
  const dueColor = task.urgency === 'overdue' ? 'text-rose-700' : 'text-amber-700'

  return (
    <li className={`flex items-center justify-between gap-4 p-3 rounded-md border ${styles}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-navy-900">
          {task.label}
          <span className="text-navy-900/30 mx-2">·</span>
          <Link to={`/listings/${task.listingId}`} className="text-navy-900/70 hover:text-gold-600">
            {task.listingAddress}
          </Link>
        </div>
        <div className={`text-xs mt-0.5 font-medium ${dueColor}`}>{task.dueLabel}</div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isExtending ? (
          <>
            <span className="text-xs text-navy-900/60">+</span>
            <input
              type="number" min="1" max="365"
              value={extendDays}
              onChange={(e) => onExtendDaysChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirmExtend()
                if (e.key === 'Escape') onCancelExtend()
              }}
              autoFocus
              className="w-14 px-2 py-1 border border-navy-900/20 rounded text-xs bg-white text-navy-900 focus:outline-none focus:border-navy-900"
            />
            <span className="text-xs text-navy-900/60">d</span>
            <button onClick={onConfirmExtend} disabled={busy}
              className="text-xs px-2.5 py-1 rounded bg-navy-900 text-cream-100 font-medium hover:bg-navy-800 disabled:opacity-50">
              OK
            </button>
            <button onClick={onCancelExtend} disabled={busy}
              className="text-xs px-1.5 py-1 text-navy-900/60 hover:text-navy-900">
              ✕
            </button>
          </>
        ) : (
          <>
            <button onClick={onComplete} disabled={busy}
              className="px-3 py-1.5 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50">
              {busy ? '…' : 'Complete'}
            </button>
            <button onClick={onStartExtend} disabled={busy}
              className="px-3 py-1.5 rounded-md border border-navy-900/20 bg-white text-navy-900 text-sm font-medium hover:border-gold-500/50 hover:text-gold-600 disabled:opacity-50">
              Extend
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function TouchpointTaskRow({ task }) {
  return (
    <li className="flex items-center justify-between gap-4 p-3 rounded-md border bg-gold-500/5 border-gold-500/30">
      <div className="min-w-0">
        <div className="text-sm font-medium text-navy-900">
          {task.label}
          <span className="text-navy-900/30 mx-2">·</span>
          <Link to={`/listings/${task.listingId}`} className="text-navy-900/70 hover:text-gold-600">
            {task.listingAddress}
          </Link>
        </div>
        <div className="text-xs mt-0.5 text-navy-900/60">Due today</div>
      </div>
      <Link
        to={`/listings/${task.listingId}`}
        className="px-3 py-1.5 rounded-md bg-gold-500 text-navy-950 text-sm font-medium hover:bg-gold-400 whitespace-nowrap"
      >
        Open
      </Link>
    </li>
  )
}

function CustomTaskRow({ task, busy, onComplete, onSnooze, onDelete }) {
  const days = daysUntil(task.due_date)
  const overdue = days < 0
  const styles = overdue
    ? 'bg-rose-50 border-rose-200'
    : 'bg-cream-50 border-cream-200'
  const dueColor = overdue ? 'text-rose-700' : 'text-navy-900/60'
  const dueLabel = overdue ? `${Math.abs(days)}d overdue` : 'Due today'

  return (
    <li className={`flex items-center justify-between gap-4 p-3 rounded-md border ${styles}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-navy-900">{task.title}</div>
        <div className="text-xs mt-0.5">
          <span className={overdue ? `${dueColor} font-medium` : dueColor}>{dueLabel}</span>
          {task.listings && (
            <>
              <span className="text-navy-900/30 mx-1.5">·</span>
              <Link to={`/listings/${task.listings.id}`} className="text-navy-900/60 hover:text-gold-600">
                {task.listings.address}
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={onComplete} disabled={busy}
          className="px-3 py-1.5 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50">
          {busy ? '…' : 'Done'}
        </button>
        <button onClick={() => onSnooze(1)} disabled={busy}
          className="px-2 py-1.5 rounded-md border border-cream-200 text-navy-900 text-xs font-medium hover:border-gold-500/50 hover:text-gold-600 disabled:opacity-50"
          title="Snooze 1 day">
          +1d
        </button>
        <button onClick={() => onSnooze(7)} disabled={busy}
          className="px-2 py-1.5 rounded-md border border-cream-200 text-navy-900 text-xs font-medium hover:border-gold-500/50 hover:text-gold-600 disabled:opacity-50"
          title="Snooze 1 week">
          +1w
        </button>
        <button onClick={onDelete} disabled={busy}
          className="px-1.5 py-1 text-navy-900/40 hover:text-rose-600 disabled:opacity-50 text-sm"
          title="Delete task">
          ✕
        </button>
      </div>
    </li>
  )
}

function AddTaskForm({ listings, onAdd, onCancel }) {
  const [title, setTitle] = useState('')
  const [listingId, setListingId] = useState('')
  const [dueDate, setDueDate] = useState(todayDateStr())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleAdd() {
    if (!title.trim()) return setError('Title is required.')
    try {
      setSaving(true)
      setError(null)
      await onAdd({ title: title.trim(), listing_id: listingId, due_date: dueDate })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 p-3 rounded-md border border-cream-200 bg-cream-50/40 space-y-3">
      <input
        type="text"
        placeholder="What needs doing? (e.g. Call John about pricing)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onCancel() }}
        autoFocus
        disabled={saving}
        className="input"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
          disabled={saving}
          className="input bg-white text-sm"
        >
          <option value="">No specific listing</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>{l.address}</option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={saving}
          className="input text-sm"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={saving || !title.trim()}
          className="px-3 py-1.5 rounded-md bg-navy-900 text-cream-100 text-sm font-medium hover:bg-navy-800 disabled:opacity-50">
          {saving ? 'Adding…' : 'Add task'}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="px-3 py-1.5 text-sm text-navy-900/60 hover:text-navy-900">
          Cancel
        </button>
      </div>
    </div>
  )
}

function todayLabel() {
  return new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'short',
  })
}

// -----------------------------------------------------------------------------
// Derive condition + touchpoint tasks from the listings query
// -----------------------------------------------------------------------------
function buildDerivedTasks(listings) {
  const tasks = []
  const today = new Date()
  const dayOfWeek = today.getDay()

  for (const listing of listings) {
    const activeContract = listing.contracts?.find((c) => c.is_active)
    if (activeContract && Array.isArray(activeContract.conditions)) {
      activeContract.conditions.forEach((c, i) => {
        if (c.cleared_at) return
        const days = daysUntil(c.due_date)
        if (days > 0) return
        tasks.push({
          id: `cond-${activeContract.id}-${i}`,
          type: 'condition',
          urgency: days < 0 ? 'overdue' : 'today',
          listingId: listing.id,
          listingAddress: listing.address,
          label: CONDITION_LABELS[c.type] || c.label || 'Other condition',
          dueLabel: days < 0 ? `${Math.abs(days)}d overdue` : 'Due today',
          onComplete: () => updateConditionAt(activeContract, i, (cond) => ({
            ...cond, cleared_at: todayDateStr(),
          })),
          onExtend: (days) => updateConditionAt(activeContract, i, (cond) => ({
            ...cond, due_date: addDaysToDateStr(cond.due_date, days),
          })),
        })
      })
    }

    if (listing.stage !== 'launched_online') continue

    const expectedType =
      dayOfWeek === 1 ? 'monday_report' :
      dayOfWeek === 3 ? 'wednesday_sms' :
      dayOfWeek === 5 ? 'friday_sms' :
      null
    if (!expectedType) continue

    const alreadySent = (listing.touchpoints ?? []).some(
      (t) => t.type === expectedType && t.sent_at && isSameIsoWeek(new Date(t.sent_at), today)
    )
    if (alreadySent) continue

    tasks.push({
      id: `tp-${listing.id}-${expectedType}`,
      type: 'touchpoint',
      urgency: 'today',
      listingId: listing.id,
      listingAddress: listing.address,
      label: TOUCHPOINT_LABELS[expectedType],
      dueLabel: 'Due today',
    })
  }

  tasks.sort((a, b) => {
    if (a.urgency === 'overdue' && b.urgency !== 'overdue') return -1
    if (b.urgency === 'overdue' && a.urgency !== 'overdue') return 1
    return 0
  })

  return tasks
}

async function updateConditionAt(contract, idx, updater) {
  const updated = contract.conditions.map((c, i) => (i === idx ? updater(c) : c))
  await updateContractConditions(contract.id, updated)
}

function isSameIsoWeek(d1, d2) {
  return startOfIsoWeek(d1).getTime() === startOfIsoWeek(d2).getTime()
}

function startOfIsoWeek(d) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}
