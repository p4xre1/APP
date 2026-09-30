/**
 * Cash flow - money that actually moved, as opposed to revenue earned.
 *
 * One canonical calculation:
 *   - money in  = payments recorded on invoices, on their payment date, plus
 *     the settled remainder of invoices marked paid (on the paid date). An
 *     unpaid invoice is not cash, whatever its status.
 *   - money out = expenses on their recorded date, plus settled credit notes
 *     (a refund) on their paid date. An open credit note reduces receivables,
 *     not cash.
 *   - net = in − out. Currencies are never mixed.
 *
 * Periods are plain local-date ranges; `periodRange` derives month/quarter/
 * year/all from today. No accounting-period infrastructure.
 */
import type { Invoice, Expense } from '../store/types'
import { sumMoney } from './format'
import { getPreferences } from './preferences'
import { isCreditNote } from './credit-notes'
import { paymentsTotal } from './payments'
import { dayNumber, isISODate, todayISO } from './subscriptions'

export interface CashFlowRow {
  currency: string
  moneyIn: number
  moneyOut: number
  net: number
}

export type CashFlowPeriod = 'month' | 'quarter' | 'year' | 'all'

const pad = (value: number) => String(value).padStart(2, '0')

/** Local calendar date of a timestamp (the same convention the documents use). */
export function localDateOf(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** First day of the period containing `today` … `today`. 'all' is unbounded. */
export function periodRange(period: CashFlowPeriod, today = todayISO()): { from: string; to: string } {
  if (period === 'all' || !isISODate(today)) return { from: '0001-01-01', to: '9999-12-31' }
  const [year, month] = today.split('-').map(Number)
  if (period === 'year') return { from: `${year}-01-01`, to: today }
  if (period === 'quarter') return { from: `${year}-${pad(Math.floor((month - 1) / 3) * 3 + 1)}-01`, to: today }
  return { from: `${year}-${pad(month)}-01`, to: today }
}

export function cashFlow(
  invoices: Invoice[],
  expenses: Expense[],
  from: string,
  to: string,
  defaultCurrency = getPreferences().defaultCurrency,
): CashFlowRow[] {
  const inRange = (date: string) =>
    isISODate(date) && dayNumber(date) >= dayNumber(from) && dayNumber(date) <= dayNumber(to)
  const flows = new Map<string, { in: number[]; out: number[] }>()
  const bucket = (currency: string) => {
    const entry = flows.get(currency) || { in: [], out: [] }
    flows.set(currency, entry)
    return entry
  }

  for (const invoice of invoices) {
    const currency = invoice.currency || defaultCurrency
    const settledDate = localDateOf(invoice.paidAt ?? invoice.occurredAt ?? invoice.createdAt)
    if (isCreditNote(invoice)) {
      // A settled credit note is money going back to the customer.
      if (invoice.status === 'paid' && inRange(settledDate)) bucket(currency).out.push(invoice.total)
      continue
    }
    for (const payment of invoice.payments || []) {
      if (inRange(payment.date)) bucket(currency).in.push(payment.amount)
    }
    if (invoice.status === 'paid') {
      // Whatever the recorded payments did not cover settled on the paid date.
      const remainder = sumMoney([invoice.total, -paymentsTotal(invoice, defaultCurrency)], currency)
      if (remainder > 0 && inRange(settledDate)) bucket(currency).in.push(remainder)
    }
  }

  for (const expense of expenses) {
    const currency = expense.currency || defaultCurrency
    const date = isISODate(expense.date) ? expense.date : localDateOf(expense.occurredAt ?? expense.createdAt)
    if (inRange(date)) bucket(currency).out.push(expense.amount)
  }

  return [...flows]
    .map(([currency, { in: moneyIn, out: moneyOut }]) => ({
      currency,
      moneyIn: sumMoney(moneyIn, currency),
      moneyOut: sumMoney(moneyOut, currency),
      net: sumMoney([...moneyIn, ...moneyOut.map(amount => -amount)], currency),
    }))
    .filter(row => row.moneyIn !== 0 || row.moneyOut !== 0)
}
