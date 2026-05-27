export function formatAusDate(input) {
  if (!input) return ''
  return new Date(input).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(input) {
  if (!input) return ''
  return new Date(input).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRelativeDate(input) {
  if (!input) return ''
  const days = Math.round((Date.now() - new Date(input).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.round(days / 7)}w ago`
  return formatAusDate(input)
}

export function daysUntil(dateStr) {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due - today) / (1000 * 60 * 60 * 24))
}

export function daysOnMarket(listDateStr) {
  if (!listDateStr) return 0
  const list = new Date(listDateStr)
  list.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today - list) / (1000 * 60 * 60 * 24)))
}

export function formatCurrency(amount) {
  if (amount == null) return ''
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().split('T')[0]
}

export function todayDateStr() {
  return new Date().toISOString().split('T')[0]
}

// Simple cyclical rotation: Monday → Wed → Fri → Monday.
export function nextTouchpointAfter(lastType) {
  switch (lastType) {
    case 'monday_report':  return 'wednesday_sms'
    case 'wednesday_sms':  return 'friday_sms'
    case 'friday_sms':     return 'monday_report'
    default:               return 'monday_report'
  }
}

export const CONDITION_LABELS = {
  finance: 'Finance',
  building_pest: 'Building & Pest',
  firb: 'FIRB',
  body_corporate: 'Body Corporate',
  other: 'Other',
}

export const TOUCHPOINT_LABELS = {
  monday_report: 'Monday Report',
  wednesday_sms: 'Wednesday SMS',
  friday_sms: 'Friday SMS',
}

export const STAGE_LABELS = {
  listed: 'Listed',
  photos_taken: 'Photos Taken',
  tenants_contacted: 'Tenants Contacted',
  launched_online: 'Launched Online',
  under_contract: 'Under Contract',
  unconditional: 'Unconditional',
  settlement: 'Settlement',
  archived: 'Archived',
}

export const CAMPAIGN_TYPE_LABELS = {
  private_treaty: 'Private Treaty',
  auction: 'Auction',
  eoi: 'Expression of Interest',
}
