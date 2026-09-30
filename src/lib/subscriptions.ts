/**
 * Fatorati Offline - Subscription tracking
 *
 * Everything here is pure and timezone-safe. Calendar dates are handled as
 * YYYY-MM-DD strings and compared through UTC day numbers, so a DST jump of
 * 23 or 25 hours can never turn "7 days left" into "6 days left". "Today" is
 * always the device's local calendar date, and tests can pin both the clock and
 * the time zone.
 */

import { decimals } from './format'
import type { Subscription, SubscriptionCycle, SubscriptionCurrency } from '../store/types'

export const SUBSCRIPTION_CURRENCIES: SubscriptionCurrency[] = ['MAD', 'USD', 'EUR']
export const SUBSCRIPTION_CYCLES: SubscriptionCycle[] = ['monthly', 'yearly', 'one_time_period']
export const DEFAULT_WARN_DAYS = 7
export const MIN_WARN_DAYS = 1
export const MAX_WARN_DAYS = 30
export const MAX_PERIOD_MONTHS = 120
export const MAX_SERVICE_NAME = 80
export const MAX_TEXT = 120

export type SubscriptionStatus = 'active' | 'expiring_soon' | 'expired' | 'cancelled'

const DAY_MS = 86_400_000
const pad = (value: number) => String(value).padStart(2, '0')
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`

export function isSubscriptionCurrency(value: unknown): value is SubscriptionCurrency {
  return typeof value === 'string' && (SUBSCRIPTION_CURRENCIES as string[]).includes(value)
}

export function isSubscriptionCycle(value: unknown): value is SubscriptionCycle {
  return typeof value === 'string' && (SUBSCRIPTION_CYCLES as string[]).includes(value)
}

/** Parses a YYYY-MM-DD string without going through Date (no UTC shifting). */
export function parseISODate(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

export const isISODate = (value: unknown): value is string => parseISODate(value) !== null

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Calendar days since 1970-01-01, free of DST and of the host time zone. */
export function dayNumber(value: string): number {
  const parsed = parseISODate(value)
  if (!parsed) throw new Error('Invalid date')
  return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / DAY_MS)
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from)
}

/**
 * Today in the device's local calendar. `timeZone` exists for tests and for
 * callers that already know the zone; the app itself passes nothing and gets
 * the phone's local date, so travelling across zones cannot shift a renewal.
 */
export function todayISO(now: number = Date.now(), timeZone?: string): string {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
    return parts
  }
  const date = new Date(now)
  return iso(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/**
 * Adds whole months, clamping to the last day of shorter months: a subscription
 * starting on the 31st renews on the 30th (or 28th/29th in February), never on
 * the 3rd of the following month. Leap years are handled by daysInMonth().
 */
export function addMonthsClamped(value: string, months: number): string {
  const parsed = parseISODate(value)
  if (!parsed) throw new Error('Invalid date')
  const total = parsed.year * 12 + (parsed.month - 1) + Math.trunc(months)
  const year = Math.floor(total / 12)
  const month = total % 12 + 1
  return iso(year, month, Math.min(parsed.day, daysInMonth(year, month)))
}

/** Months covered by one payment of this entry (a monthly cycle covers one month). */
export function cycleMonths(subscription: Pick<Subscription, 'billingCycle' | 'periodMonths'>): number {
  if (subscription.billingCycle === 'monthly') return 1
  if (subscription.billingCycle === 'yearly') return 12
  const period = Number(subscription.periodMonths)
  return Number.isFinite(period) && period >= 1 ? Math.min(Math.trunc(period), MAX_PERIOD_MONTHS) : 1
}

/**
 * Next occurrence of the billing cycle that is not in the past (today counts, so
 * an entry renewing today reports 0 days left rather than jumping a period).
 */
export function nextRenewalDate(subscription: Pick<Subscription, 'billingCycle' | 'startDate'>, today: string = todayISO()): string {
  const start = parseISODate(subscription.startDate)
  if (!start) throw new Error('Invalid date')
  const step = subscription.billingCycle === 'monthly' ? 1 : subscription.billingCycle === 'yearly' ? 12 : cycleMonths(subscription)
  const target = parseISODate(today)
  if (!target) throw new Error('Invalid date')
  // Jump most of the way in one step, then walk forward: cheap for entries that
  // started years ago, exact for month-end and leap-year starts.
  const elapsed = (target.year * 12 + target.month - 1) - (start.year * 12 + start.month - 1)
  let months = elapsed > 0 ? Math.floor(elapsed / step) * step : 0
  const todayDay = dayNumber(today)
  for (let guard = 0; guard < 8; guard++) {
    const candidate = addMonthsClamped(subscription.startDate, months)
    if (dayNumber(candidate) >= todayDay) return candidate
    months += step
  }
  throw new Error('Invalid date')
}

/**
 * The date a non-renewing entry ends. One billing period is covered:
 * `one_time_period` covers `periodMonths`, monthly covers a month, yearly a year.
 */
export function subscriptionEndDate(subscription: Subscription): string {
  return addMonthsClamped(subscription.startDate, cycleMonths(subscription))
}

export interface SubscriptionView {
  status: SubscriptionStatus
  /** Next renewal for auto-renewing entries, end date otherwise. */
  date: string
  /** Calendar days until `date`; 0 means today, negative means in the past. */
  daysLeft: number
}

export function warnDays(value: unknown): number {
  const days = Number(value)
  if (!Number.isFinite(days)) return DEFAULT_WARN_DAYS
  return Math.min(Math.max(Math.trunc(days), MIN_WARN_DAYS), MAX_WARN_DAYS)
}

/**
 * Status of one entry. Auto-renewing entries never expire: they are either
 * active or expiring soon and report the next renewal date instead.
 */
export function subscriptionView(subscription: Subscription, options: { now?: number; timeZone?: string; warn?: number } = {}): SubscriptionView {
  const today = todayISO(options.now, options.timeZone)
  const warn = warnDays(options.warn)
  if (subscription.cancelledAt) {
    const date = subscription.billingCycle === 'one_time_period' || !subscription.autoRenew ? subscriptionEndDate(subscription) : nextRenewalDate(subscription, today)
    return { status: 'cancelled', date, daysLeft: daysBetween(today, date) }
  }
  const autoRenewing = subscription.autoRenew && subscription.billingCycle !== 'one_time_period'
  const date = autoRenewing ? nextRenewalDate(subscription, today) : subscriptionEndDate(subscription)
  const daysLeft = daysBetween(today, date)
  if (daysLeft < 0) return { status: 'expired', date, daysLeft }
  return { status: daysLeft <= warn ? 'expiring_soon' : 'active', date, daysLeft }
}

/** The single date a list, a banner or a reminder should point at. */
export function subscribeEndOrRenewal(subscription: Subscription, options: { now?: number; timeZone?: string; warn?: number } = {}): string {
  return subscriptionView(subscription, options).date
}

export interface SubscriptionSummary {
  currency: SubscriptionCurrency
  monthlyMinor: number
  yearlyMinor: number
  count: number
}

/** Amount in major units for a stored minor-unit integer. */
export function minorToAmount(minor: number, currency: string): number {
  const scale = 10 ** decimals(currency)
  return minor / scale
}

export function amountToMinor(amount: number, currency: string): number {
  const scale = 10 ** decimals(currency)
  return Math.round(amount * scale)
}

/**
 * Normalised monthly cost in minor units. Rounded once, at the end, so twelve
 * monthly entries never drift by a cent against the yearly figure.
 */
export function monthlyMinor(subscription: Pick<Subscription, 'amountMinor' | 'billingCycle' | 'periodMonths'>): number {
  return Math.round(subscription.amountMinor / cycleMonths(subscription))
}

export function yearlyMinor(subscription: Pick<Subscription, 'amountMinor' | 'billingCycle' | 'periodMonths'>): number {
  return Math.round(subscription.amountMinor * (12 / cycleMonths(subscription)))
}

/** Cancelled and expired entries are history, not ongoing cost, so they are excluded. */
export function countsTowardTotals(subscription: Subscription, options: { now?: number; timeZone?: string; warn?: number } = {}): boolean {
  const status = subscriptionView(subscription, options).status
  return status !== 'cancelled' && status !== 'expired'
}

/**
 * Totals per currency. Different currencies are never added together: the user
 * gets one monthly and one yearly figure for every currency in use.
 */
export function subscriptionSummary(subscriptions: Subscription[], options: { now?: number; timeZone?: string; warn?: number } = {}): SubscriptionSummary[] {
  const totals = new Map<SubscriptionCurrency, SubscriptionSummary>()
  for (const subscription of subscriptions) {
    if (!countsTowardTotals(subscription, options)) continue
    const current = totals.get(subscription.currency) || { currency: subscription.currency, monthlyMinor: 0, yearlyMinor: 0, count: 0 }
    current.monthlyMinor += monthlyMinor(subscription)
    current.yearlyMinor += yearlyMinor(subscription)
    current.count += 1
    totals.set(subscription.currency, current)
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency))
}

/** List order: nearest date first, cancelled entries last. */
export function sortByNearest(subscriptions: Subscription[], options: { now?: number; timeZone?: string; warn?: number } = {}): { subscription: Subscription; view: SubscriptionView }[] {
  return subscriptions
    .map(subscription => ({ subscription, view: subscriptionView(subscription, options) }))
    .sort((a, b) => {
      const cancelled = Number(a.view.status === 'cancelled') - Number(b.view.status === 'cancelled')
      if (cancelled !== 0) return cancelled
      const expired = Number(a.view.status === 'expired') - Number(b.view.status === 'expired')
      if (a.view.daysLeft !== b.view.daysLeft) return expired !== 0 ? -expired : a.view.daysLeft - b.view.daysLeft
      return a.subscription.serviceName.localeCompare(b.subscription.serviceName)
    })
}

/** Entries the in-app banner shows: expiring soon or already expired. */
export function attentionList(subscriptions: Subscription[], options: { now?: number; timeZone?: string; warn?: number } = {}): { subscription: Subscription; view: SubscriptionView }[] {
  return sortByNearest(subscriptions, options).filter(row => row.view.status === 'expiring_soon' || row.view.status === 'expired')
}

export function subscriptionCategories(subscriptions: Subscription[]): string[] {
  return [...new Set(subscriptions.map(row => (row.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

/** Validation shared by the form and covered by the tests. */
export function validateSubscription(input: {
  serviceName: string; amountMinor: number; currency: string; startDate: string; periodMonths?: number
}): string | null {
  if (!input.serviceName.trim()) return 'Enter a service name'
  if (input.serviceName.trim().length > MAX_SERVICE_NAME) return 'Service name is too long'
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) return 'Enter an amount greater than zero'
  if (!isSubscriptionCurrency(input.currency)) return 'Choose a currency'
  if (!isISODate(input.startDate)) return 'Choose a valid date'
  if (input.periodMonths !== undefined && (!Number.isInteger(input.periodMonths) || input.periodMonths < 1 || input.periodMonths > MAX_PERIOD_MONTHS)) return 'Enter a period between 1 and 120 months'
  return null
}
