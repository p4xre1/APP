/**
 * Invoice payments - the one place that knows what has been paid on a document.
 * See docs/design-payments.md for the full rationale. Partial payments are a
 * balance, never a fake status; over-payments are rejected; a refund is a
 * credit note, not a negative payment.
 */
import type { Invoice, InvoicePayment } from '../store/types'
import { sumMoney, roundMoney } from './format'
import { isISODate } from './subscriptions'
import { getPreferences } from './preferences'

export const MAX_PAYMENTS_PER_INVOICE = 200

/** Minor-unit sum of the recorded payments. */
export function paymentsTotal(invoice: Pick<Invoice, 'payments' | 'currency'>, defaultCurrency = getPreferences().defaultCurrency): number {
  const currency = invoice.currency || defaultCurrency
  return sumMoney((invoice.payments || []).map(payment => payment.amount), currency)
}

/**
 * What is still owed on this document. A stored status of 'paid' means settled
 * even without recorded payments (that is what every pre-payments invoice
 * says); otherwise total minus payments, never below zero.
 */
export function invoiceBalance(invoice: Pick<Invoice, 'payments' | 'currency' | 'total' | 'status'>, defaultCurrency = getPreferences().defaultCurrency): number {
  if (invoice.status === 'paid') return 0
  const currency = invoice.currency || defaultCurrency
  return Math.max(0, sumMoney([invoice.total, -paymentsTotal(invoice, defaultCurrency)], currency))
}

/** Throws a translated-key error when the payment cannot be recorded. */
export function validatePayment(invoice: Invoice, amount: number, date: string, defaultCurrency = getPreferences().defaultCurrency): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a payment amount greater than zero.')
  if (!isISODate(date)) throw new Error('Enter a valid payment date.')
  if (invoice.kind === 'credit_note') throw new Error('A credit note takes no payments; settle it by changing its status.')
  if ((invoice.payments || []).length >= MAX_PAYMENTS_PER_INVOICE) throw new Error('Operation failed')
  const currency = invoice.currency || defaultCurrency
  if (roundMoney(amount, currency) > invoiceBalance(invoice, defaultCurrency)) {
    throw new Error('A payment cannot exceed the remaining balance of the invoice.')
  }
}

/**
 * The patch that records a payment: the appended array, plus status 'paid' and
 * paidAt (noon of the payment date, local) when the balance reaches zero.
 */
export function recordPayment(
  invoice: Invoice,
  entry: { amount: number; date: string; method?: string; reference?: string; notes?: string },
  defaultCurrency = getPreferences().defaultCurrency,
): Partial<Invoice> {
  validatePayment(invoice, entry.amount, entry.date, defaultCurrency)
  const currency = invoice.currency || defaultCurrency
  const payment: InvoicePayment = {
    id: crypto.randomUUID(),
    amount: roundMoney(entry.amount, currency),
    date: entry.date,
    ...(entry.method?.trim() ? { method: entry.method.trim() } : {}),
    ...(entry.reference?.trim() ? { reference: entry.reference.trim() } : {}),
    ...(entry.notes?.trim() ? { notes: entry.notes.trim() } : {}),
  }
  const payments = [...(invoice.payments || []), payment]
  const settled = sumMoney([invoice.total, -sumMoney(payments.map(p => p.amount), currency)], currency) <= 0
  return settled
    ? { payments, status: 'paid', paidAt: invoice.paidAt || new Date(`${entry.date}T12:00:00`).getTime() }
    : { payments }
}

/**
 * The patch that removes a payment. When the removal re-opens an invoice whose
 * 'paid' status came from its payments, the status returns to 'sent'.
 */
export function removePayment(invoice: Invoice, paymentId: string, defaultCurrency = getPreferences().defaultCurrency): Partial<Invoice> {
  const payments = (invoice.payments || []).filter(payment => payment.id !== paymentId)
  const currency = invoice.currency || defaultCurrency
  const open = sumMoney([invoice.total, -sumMoney(payments.map(p => p.amount), currency)], currency) > 0
  return invoice.status === 'paid' && open
    ? { payments, status: 'sent', paidAt: undefined }
    : { payments }
}
