import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addDaysToDateStr,
  daysOnMarket,
  daysUntil,
  formatCurrency,
  formatRelativeDate,
  nextTouchpointAfter,
} from './format'

describe('format helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T10:00:00+10:00'))
  })

  afterEach(() => vi.useRealTimers())

  it('calculates listing and due-date distances from local calendar days', () => {
    expect(daysOnMarket('2026-07-01')).toBe(15)
    expect(daysUntil('2026-07-18')).toBe(2)
  })

  it('never reports negative days on market', () => {
    expect(daysOnMarket('2026-07-20')).toBe(0)
  })

  it('formats recent dates in plain language', () => {
    expect(formatRelativeDate('2026-07-16T08:00:00+10:00')).toBe('today')
    expect(formatRelativeDate('2026-07-15T08:00:00+10:00')).toBe('yesterday')
    expect(formatRelativeDate('2026-07-12T08:00:00+10:00')).toBe('4 days ago')
  })

  it('rotates through the three vendor touchpoint types', () => {
    expect(nextTouchpointAfter('monday_report')).toBe('wednesday_sms')
    expect(nextTouchpointAfter('wednesday_sms')).toBe('friday_sms')
    expect(nextTouchpointAfter('friday_sms')).toBe('monday_report')
    expect(nextTouchpointAfter()).toBe('monday_report')
  })

  it('handles date arithmetic and Australian currency', () => {
    expect(addDaysToDateStr('2026-07-16', 5)).toBe('2026-07-21')
    expect(formatCurrency(925000)).toContain('925,000')
  })
})
