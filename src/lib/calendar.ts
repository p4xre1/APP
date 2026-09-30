/**
 * Fatorati Offline - Calendar aggregation
 *
 * Pure, testable date logic. The calendar screen itself only paints what this file
 * returns, which is what keeps month maths, week starts, leap years and DST free of
 * UI code.
 *
 * Every date here is a local calendar date (YYYY-MM-DD) handled through the
 * subscription helpers, so no time zone or daylight-saving jump can move an item to
 * another day. The visible month is the only thing that gets computed: a list of
 * thousands of notes is filtered down to the days on screen before anything is
 * grouped, and the same function serves the month view and the agenda list.
 */

import { dayNumber, isISODate, parseISODate, subscribeEndOrRenewal, todayISO, warnDays as clampWarnDays } from './subscriptions'
import { isDated, noteTitle, noteTime } from './notes'
import type { Estimate, Invoice, Note, Subscription } from '../store/types'

/** Kinds of row the calendar can show. Each one has its own icon and its own label. */
export type CalendarKind = 'idea' | 'note' | 'task' | 'invoice' | 'subscription' | 'estimate'

/** Filter toggles, one per group of rows. */
export const CALENDAR_GROUPS = ['notes', 'invoices', 'subscriptions', 'estimates'] as const
export type CalendarGroup = typeof CALENDAR_GROUPS[number]

export interface CalendarItem {
  /** Stable identity for React keys: kind plus record id. */
  key: string
  kind: CalendarKind
  group: CalendarGroup
  /** Record id, so tapping the row can open the source screen. */
  id: string
  /** Local calendar date (YYYY-MM-DD) the item belongs to. */
  date: string
  /** Optional HH:mm, only notes carry a time. */
  time?: string
  /** i18n key of the row label ("Invoice due", "Renewal", ...). */
  label: string
  /** Data shown next to the label: a number, a title, a service name. */
  detail: string
  /** An unpaid invoice whose due date is already behind us. */
  overdue?: boolean
  /** A task that is done; shown with a struck line instead of an alarm. */
  done?: boolean
}

export interface CalendarSources {
  notes: Note[]
  invoices: Invoice[]
  subscriptions: Subscription[]
  estimates: Estimate[]
}

export interface CalendarOptions {
  /**
   * Local calendar date used as "today"; defaults to the device date. Everything is
   * resolved against this one date, so the calendar, the dashboard card and the
   * reminders can never disagree about which day it is (tests pin it).
   */
  today?: string
  /** Subscription warning window, in days. */
  warn?: number
}

export interface CalendarDay {
  date: string
  /** Day of the month, 1..31. */
  day: number
  /** False for the days of the neighbouring months that pad the first and last week. */
  inMonth: boolean
}

export const DEFAULT_FILTERS: CalendarGroup[] = [...CALENDAR_GROUPS]

const pad = (value: number) => String(value).padStart(2, '0')
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`

/** Moves a year/month pair by whole months, so December 2026 + 1 is January 2027. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + Math.trunc(delta)
  return { year: Math.floor(total / 12), month: (total % 12 + 12) % 12 + 1 }
}

/** Last day of a month, as a number: 28, 29 in a leap year, 30 or 31. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/**
 * The weeks of one month. The first week starts at the first day of the grid, which is
 * the chosen week start (Monday by default, Saturday or Sunday in Settings), and every
 * week has exactly seven days; the leading and trailing days come from the neighbouring
 * months and are marked with `inMonth: false`, so a row printed on the 1st or the 31st
 * is never hidden.
 */
export function monthGrid(year: number, month: number, firstDay: 0 | 1 | 6 = 1): CalendarDay[] {
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() - firstDay + 7) % 7
  const start = Date.UTC(year, month - 1, 1 - leading)
  const total = daysInMonth(year, month)
  const weeks = Math.ceil((leading + total) / 7)
  const days: CalendarDay[] = []
  for (let index = 0; index < weeks * 7; index++) {
    const current = new Date(start + index * 86_400_000)
    const day = current.getUTCDate()
    days.push({ date: iso(current.getUTCFullYear(), current.getUTCMonth() + 1, day), day, inMonth: current.getUTCMonth() + 1 === month && current.getUTCFullYear() === year })
  }
  return days
}

/** First and last calendar date the grid shows, padding included. */
export function gridRange(year: number, month: number, firstDay: 0 | 1 | 6 = 1): { from: string; to: string } {
  const days = monthGrid(year, month, firstDay)
  return { from: days[0].date, to: days[days.length - 1].date }
}

/** Weekday column headings, starting at the chosen first day of the week. */
export function weekdayLabels(locale: string, firstDay: 0 | 1 | 6 = 1): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, 0, 4 + (Number(firstDay) + index) % 7)))
}

/**
 * Every dated item of the four sources, as one flat list.
 *
 * - notes and tasks with a date (an undated note has no place on a calendar; an
 *   archived note is set aside and stays out, a done task keeps its day and is drawn
 *   as finished),
 * - invoices that are not paid yet, marked as overdue once their due date is behind us,
 * - subscriptions that are neither cancelled nor expired, on their next renewal or end date,
 * - estimates that are still pending (draft or sent), on their expiry date.
 *
 * A note that points at a deleted customer, invoice or project still appears: the link
 * is only used when opening it, and the lookup simply finds nothing.
 */
export function collectCalendarItems(sources: CalendarSources, options: CalendarOptions = {}): CalendarItem[] {
  const today = options.today && isISODate(options.today) ? options.today : todayISO()
  // Noon of that local date: far from both midnights, so no DST jump can move it.
  const noon = (() => {
    const parsed = parseISODate(today)!
    return new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0).getTime()
  })()
  const items: CalendarItem[] = []

  for (const note of sources.notes) {
    // An archived note is put away: it keeps its text but leaves the calendar, exactly
    // like it loses its reminder.
    if (!isDated(note) || note.archived === true) continue
    const time = noteTime(note)
    items.push({
      // The kind keeps the note's own type, so an idea and a plain note never end up
      // behind the same icon: the row shows icon *and* label.
      key: `note:${note.id}`, kind: note.type, group: 'notes', id: note.id,
      date: note.date!, ...(time ? { time } : {}),
      label: note.type === 'task' ? 'Task' : note.type === 'note' ? 'Note' : 'Idea',
      detail: noteTitle(note), done: note.type === 'task' && note.done === true,
    })
  }

  for (const invoice of sources.invoices) {
    if (invoice.status === 'paid' || !isISODate(invoice.dueDate)) continue
    const overdue = dayNumber(invoice.dueDate) < dayNumber(today)
    items.push({
      key: `invoice:${invoice.id}`, kind: 'invoice', group: 'invoices', id: invoice.id, date: invoice.dueDate,
      label: overdue ? 'Overdue invoice' : 'Invoice due', detail: invoice.number, overdue,
    })
  }

  for (const subscription of sources.subscriptions) {
    if (subscription.cancelledAt) continue
    const date = subscribeEndOrRenewal(subscription, { now: noon, warn: clampWarnDays(options.warn) })
    // An entry whose date already passed is history, not an upcoming item.
    if (!isISODate(date) || dayNumber(date) < dayNumber(today)) continue
    const renewing = subscription.autoRenew && subscription.billingCycle !== 'one_time_period'
    items.push({
      key: `subscription:${subscription.id}`, kind: 'subscription', group: 'subscriptions', id: subscription.id, date,
      label: renewing ? 'Renewal' : 'Subscription ends', detail: subscription.serviceName,
    })
  }

  for (const estimate of sources.estimates) {
    if (estimate.status === 'accepted' || estimate.status === 'declined' || !isISODate(estimate.expiryDate)) continue
    items.push({
      key: `estimate:${estimate.id}`, kind: 'estimate', group: 'estimates', id: estimate.id, date: estimate.expiryDate,
      label: 'Estimate expires', detail: estimate.number,
    })
  }

  return items.sort((a, b) => (a.date === b.date ? (a.time || '99:99').localeCompare(b.time || '99:99') || a.detail.localeCompare(b.detail) : a.date < b.date ? -1 : 1))
}

/** Keeps the visible window only, then drops the groups the user switched off. */
export function itemsInRange(items: CalendarItem[], from: string, to: string, filters: CalendarGroup[] = DEFAULT_FILTERS): CalendarItem[] {
  const start = dayNumber(from), end = dayNumber(to)
  return items.filter(item => {
    if (!filters.includes(item.group)) return false
    const day = dayNumber(item.date)
    return day >= start && day <= end
  })
}

/** Items of one day, in draw order (time first, then label). */
export function itemsOn(items: CalendarItem[], date: string): CalendarItem[] {
  return items.filter(item => item.date === date)
}

export function groupByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const days = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const list = days.get(item.date)
    if (list) list.push(item)
    else days.set(item.date, [item])
  }
  return days
}

/** i18n key and count for the accessible day description ("3 items"). */
export function daySummary(count: number): { key: string; count: number } {
  return count === 0 ? { key: 'No items', count } : { key: '{count} items', count }
}

/**
 * The dashboard card: dated items from today up to `days` days ahead, already sorted.
 * It is the same aggregation as the calendar, deliberately, so the two can never
 * disagree about what is coming.
 */
export function upcomingItems(sources: CalendarSources, options: CalendarOptions & { days?: number } = {}): CalendarItem[] {
  const today = options.today && isISODate(options.today) ? options.today : todayISO()
  const until = iso(...(() => {
    const parsed = parseISODate(today)!
    const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day) + (options.days ?? 7) * 86_400_000)
    return [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()] as const
  })())
  return itemsInRange(collectCalendarItems(sources, { ...options, today }), today, until)
}

/** Count of items per day, for the dot markers. */
export function dayCounts(items: CalendarItem[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.date, (counts.get(item.date) ?? 0) + 1)
  return counts
}
