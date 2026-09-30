/**
 * Effective invoice status.
 *
 * The stored status stays exactly what the user set ('draft' | 'sent' | 'paid' |
 * 'overdue'), but everywhere the app *reads* a status it goes through this helper,
 * so a sent invoice whose due date is behind today's local calendar date shows as
 * overdue in the list, the dashboard, the reports and the calendar without anyone
 * touching the dropdown - and flips back to 'sent' if the due date is edited into
 * the future.
 *
 * Dates are local calendar dates (YYYY-MM-DD) compared through the same
 * `dayNumber` used by the subscription and calendar logic, so no UTC shift or DST
 * jump can move an invoice into overdue a day early or late.
 */
import { dayNumber, isISODate, todayISO } from './subscriptions'
import { roundMoney } from './format'
import { documentSign } from './credit-notes'
import { invoiceBalance } from './payments'
import type { Invoice } from '../store/types'

export type InvoiceStatus = Invoice['status']

export function effectiveStatus(
  invoice: Pick<Invoice, 'status' | 'dueDate'>,
  today: string = todayISO(),
): InvoiceStatus {
  if (invoice.status !== 'sent') return invoice.status
  if (!isISODate(invoice.dueDate) || !isISODate(today)) return invoice.status
  return dayNumber(invoice.dueDate) < dayNumber(today) ? 'overdue' : 'sent'
}

/** True when the invoice still owes money: effectively sent or overdue. */
export function isOutstanding(invoice: Pick<Invoice, 'status' | 'dueDate'>, today: string = todayISO()): boolean {
  const status = effectiveStatus(invoice, today)
  return status === 'sent' || status === 'overdue'
}

/** The pre-2.2 hardcoded payment term; also what a missing Settings.defaultDueDays means. */
export const DEFAULT_DUE_DAYS = 30
export const MAX_DUE_DAYS = 365

/** A valid payment term is a whole number of days, 0–365; anything else falls back to 30. */
export function clampDueDays(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_DUE_DAYS ? (value as number) : DEFAULT_DUE_DAYS
}

/** Calendar days between issue and due date, or null when either date is malformed. */
export function paymentTermsGap(issueDate: string, dueDate: string): number | null {
  if (!isISODate(issueDate) || !isISODate(dueDate)) return null
  return dayNumber(dueDate) - dayNumber(issueDate)
}

/**
 * The payment-term presets of the invoice builder. 0 = due on receipt. They
 * only pick a due date; the stored field stays `dueDate` and the status logic
 * (effectiveStatus, paymentTermsGap) is untouched - no second term engine.
 */
export const PAYMENT_TERM_DAYS = [0, 7, 15, 30, 45, 60] as const

/** Due date implied by a term: issue date + days, in calendar days (UTC-safe). */
export function dueDateFromTerms(issueDate: string, days: number): string {
  const base = isISODate(issueDate) ? issueDate : new Date().toISOString().slice(0, 10)
  const clamped = Number.isInteger(days) && days >= 0 && days <= MAX_DUE_DAYS ? days : DEFAULT_DUE_DAYS
  return new Date(Date.parse(`${base}T00:00:00Z`) + clamped * 86400_000).toISOString().slice(0, 10)
}

/**
 * Advisory level of a Moroccan payment term (Law 69-21): above 60 days longer
 * terms must be agreed in writing, and 120 days is the maximum that a contract
 * can set. This only drives a hint - saving is never blocked, because the user
 * may hold exactly such a written contract.
 */
export function paymentTermsLevel(gap: number | null): 'ok' | 'long' | 'excessive' {
  if (gap === null) return 'ok'
  return gap > 120 ? 'excessive' : gap > 60 ? 'long' : 'ok'
}

/**
 * What one customer still owes, per currency, computed from the invoices that
 * are effectively sent or overdue today. This replaces the stored
 * `Customer.balance`, which nothing ever updated: a stored balance can drift,
 * a computed one cannot. Currencies are never mixed - a customer with a MAD
 * and a USD invoice gets two rows.
 */
export function customerOutstanding(
  invoices: Pick<Invoice, 'status' | 'dueDate' | 'customerId' | 'total' | 'currency' | 'kind' | 'payments'>[],
  customerId: string,
  defaultCurrency: string,
  today: string = todayISO(),
): { currency: string; amount: number }[] {
  const sums = new Map<string, number>()
  for (const invoice of invoices) {
    if (invoice.customerId !== customerId || !isOutstanding(invoice, today)) continue
    const currency = invoice.currency || defaultCurrency
    // The open balance (total minus recorded payments): a partial payment
    // reduces what the customer owes. An open credit note subtracts entirely.
    sums.set(currency, (sums.get(currency) || 0) + documentSign(invoice) * invoiceBalance(invoice, defaultCurrency))
  }
  return [...sums].map(([currency, amount]) => ({ currency, amount: roundMoney(amount, currency) }))
}
