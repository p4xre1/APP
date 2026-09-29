import type { Invoice } from '../store/types'
import { sumMoney } from './format'
import { timestampDateKey } from './calendar'

export type PeriodKind = 'this-month' | 'last-month' | 'this-year' | 'custom'
export interface PeriodRange { kind: PeriodKind; from: string; to: string }

/** Period boundaries are ISO calendar dates in the selected zone, so no local midnight surprises. */
export function periodRange(kind: PeriodKind, options: { today?: string; from?: string; to?: string } = {}): PeriodRange {
  const today = options.today || new Date().toISOString().slice(0, 10)
  const [year, month] = today.split('-').map(Number)
  const pad = (value: number) => String(value).padStart(2, '0')
  const monthStart = (y: number, m: number) => `${y}-${pad(m)}-01`
  const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  if (kind === 'this-month') return { kind, from: monthStart(year, month), to: monthEnd(year, month) }
  if (kind === 'last-month') {
    const previous = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return { kind, from: monthStart(previous.y, previous.m), to: monthEnd(previous.y, previous.m) }
  }
  if (kind === 'this-year') return { kind, from: `${year}-01-01`, to: `${year}-12-31` }
  const from = options.from || today
  const to = options.to || today
  return { kind, from, to }
}

export function periodIsValid(range: PeriodRange) {
  return /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to
}

/** Invoices whose occurrence date falls inside the period, in the selected zone. */
export function invoicesInPeriod(invoices: Invoice[], range: PeriodRange, timeZone: string) {
  if (!periodIsValid(range)) return []
  return invoices.filter(invoice => {
    const date = timestampDateKey(invoice.occurredAt ?? invoice.createdAt, timeZone)
    return date >= range.from && date <= range.to
  })
}

export interface RevenueCardData {
  businessName: string
  periodLabel: string
  currency: string
  total: number
  invoiceCount: number
  paidCount: number
  pending: number
  rtl: boolean
}

/**
 * Values shown on the shareable card: paid revenue in one currency for one period.
 * Currencies are never converted or added together.
 */
export function revenueCardData(invoices: Invoice[], range: PeriodRange, options: {
  currency: string
  defaultCurrency: string
  businessName: string
  language: string
  digits?: string
  timeZone: string
}): RevenueCardData {
  const inPeriod = invoicesInPeriod(invoices, range, options.timeZone)
  const rows = inPeriod.filter(invoice => (invoice.currency || options.defaultCurrency) === options.currency)
  const paid = rows.filter(invoice => invoice.status === 'paid')
  const pendingRows = rows.filter(invoice => invoice.status === 'sent' || invoice.status === 'overdue')
  const label = new Intl.DateTimeFormat(`${options.language}-u-nu-${options.digits ?? 'latn'}`, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const format = (date: string) => label.format(new Date(`${date}T12:00:00Z`))
  return {
    businessName: options.businessName,
    periodLabel: range.from === range.to ? format(range.from) : `${format(range.from)} – ${format(range.to)}`,
    currency: options.currency,
    total: sumMoney(paid.map(invoice => invoice.total), options.currency),
    invoiceCount: paid.length,
    paidCount: paid.length,
    pending: sumMoney(pendingRows.map(invoice => invoice.total), options.currency),
    rtl: options.language === 'ar',
  }
}
