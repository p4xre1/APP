/**
 * Report aggregation, cash basis, per currency, integer minor-unit arithmetic.
 *
 * Accounting rules (the same figures feed the Dashboard and the Reports screen,
 * so the two can never disagree):
 *   - Tax collected  = tax of *paid* invoices only. A draft or an unsent invoice
 *     has collected nothing.
 *   - Revenue        = total minus tax of paid invoices ("excl. tax"): collected
 *     tax is owed to the tax authority, it is not income.
 *   - Cash received  = revenue + tax collected, so the three lines always
 *     reconcile: revenue excl. tax + tax collected = cash received.
 *   - Pending        = full total (incl. tax) of invoices whose *effective*
 *     status is sent or overdue - that is what the customer still owes.
 *   - Overdue        = the effectively overdue part of pending, as its own figure.
 *   - Net result     = revenue excl. tax − expenses (cash view, not accounting
 *     profit: expenses keep their recorded amount).
 * Currencies are never mixed; the converted block uses manual rates only and
 * counts the documents it had to omit.
 */
import type { Invoice, Expense } from '../store/types'
import { getPreferences } from './preferences'
import { sumMoney, roundMoney } from './format'
import { effectiveStatus } from './status'
import { documentSign, isCreditNote } from './credit-notes'
import { invoiceBalance } from './payments'
import { todayISO, dayNumber, isISODate } from './subscriptions'
import { localDateOf } from './cash-flow'

export function totalsByCurrency(rows: {currency?:string;amount:number}[]) {
  const groups=new Map<string,number[]>()
  for(const row of rows){const currency=row.currency||getPreferences().defaultCurrency;groups.set(currency,[...(groups.get(currency)||[]),row.amount])}
  return [...groups].map(([currency,amounts])=>({currency,total:sumMoney(amounts,currency)}))
}

export interface ReportCounts { paid: number; sent: number; overdue: number; draft: number; total: number }
export interface ReportRow {
  currency: string
  /** Paid invoices, tax excluded. */
  revenue: number
  /** Tax of paid invoices only. */
  tax: number
  /** Cash received from paid invoices, tax included (= revenue + tax). */
  received: number
  /** Outstanding: total incl. tax of effectively sent or overdue invoices. */
  pending: number
  /** The effectively overdue share of pending, incl. tax. */
  overdue: number
  expenses: number
  /** Net result, cash basis, excl. tax: revenue − expenses. */
  profit: number
  /** Documents of this currency, counted by effective status. */
  counts: ReportCounts
}

export function reportTotals(
  invoices: Invoice[],
  expenses: Expense[],
  defaultCurrency = getPreferences().defaultCurrency,
  today = todayISO(),
) {
  const currencyOf = (row: { currency?: string }) => row.currency || defaultCurrency
  const currencies = [...new Set([...invoices, ...expenses].map(currencyOf))]
  const totals: ReportRow[] = currencies.map(currency => {
    const rows = invoices.filter(row => currencyOf(row) === currency)
    const statuses = new Map(rows.map(row => [row, effectiveStatus(row, today)]))
    const paid = rows.filter(row => statuses.get(row) === 'paid')
    const outstanding = rows.filter(row => statuses.get(row) === 'sent' || statuses.get(row) === 'overdue')
    // revenue = Σ(total) − Σ(tax) of paid invoices, in one integer-unit sum.
    // Credit notes enter every aggregate with a negative sign (documentSign):
    // a settled credit note reduces revenue/tax/cash in its own period, an open
    // one reduces what the customer still owes. Amounts stay stored positive.
    const revenue = sumMoney(paid.flatMap(row => [documentSign(row) * row.total, -documentSign(row) * (row.tax || 0)]), currency)
    const tax = sumMoney(paid.map(row => documentSign(row) * (row.tax || 0)), currency)
    const received = sumMoney(paid.map(row => documentSign(row) * row.total), currency)
    // Receivables are open balances: partial payments already reduce them.
    const pending = sumMoney(outstanding.map(row => documentSign(row) * invoiceBalance(row, defaultCurrency)), currency)
    const overdue = sumMoney(rows.filter(row => statuses.get(row) === 'overdue').map(row => documentSign(row) * invoiceBalance(row, defaultCurrency)), currency)
    const spent = sumMoney(expenses.filter(row => currencyOf(row) === currency).map(row => row.amount), currency)
    // Counts describe invoices; credit notes are corrections, not more documents.
    const invoicesOnly = rows.filter(row => !isCreditNote(row))
    const counts: ReportCounts = { paid: 0, sent: 0, overdue: 0, draft: 0, total: invoicesOnly.length }
    for (const row of invoicesOnly) counts[statuses.get(row)!] += 1
    return { currency, revenue, tax, received, pending, overdue, expenses: spent, profit: sumMoney([revenue, -spent], currency), counts }
  })
  // Converted net total: paid invoices contribute their tax-free amount, expenses
  // subtract; anything without a usable manual rate is omitted and counted.
  let missing = 0
  const converted: number[] = []
  const paidEverywhere = invoices.filter(row => effectiveStatus(row, today) === 'paid')
  for (const row of [...paidEverywhere, ...expenses]) {
    const amount = 'total' in row
      ? sumMoney([documentSign(row) * row.total, -documentSign(row) * (row.tax || 0)], currencyOf(row))
      : -row.amount
    if (currencyOf(row) === defaultCurrency) converted.push(amount)
    else if (row.exchangeRate && row.rateCurrency === defaultCurrency) converted.push(roundMoney(amount * row.exchangeRate, defaultCurrency))
    else missing++
  }
  return { totals, converted: sumMoney(converted, defaultCurrency), missing }
}

/** Aged receivables buckets, oldest last. 'notDue' is what is owed but not yet late. */
export interface AgedRow {
  currency: string
  notDue: number
  d1to30: number
  d31to60: number
  d61to90: number
  d90plus: number
  /** Sum of the buckets = open receivables of this currency. */
  total: number
}

/**
 * Aged receivables from the same open balances the other reports use: each
 * effectively sent/overdue document contributes its balance (credit notes
 * subtract) to the bucket of `today − dueDate`. An invoice due today or later
 * is "not due"; day 1 after the due date lands in 1–30.
 */
export function agedReceivables(
  invoices: Invoice[],
  defaultCurrency = getPreferences().defaultCurrency,
  today = todayISO(),
): AgedRow[] {
  const buckets = new Map<string, AgedRow>()
  const todayDay = dayNumber(today)
  for (const invoice of invoices) {
    const status = effectiveStatus(invoice, today)
    if (status !== 'sent' && status !== 'overdue') continue
    const currency = invoice.currency || defaultCurrency
    const amount = documentSign(invoice) * invoiceBalance(invoice, defaultCurrency)
    if (amount === 0) continue
    const row = buckets.get(currency) || { currency, notDue: 0, d1to30: 0, d31to60: 0, d61to90: 0, d90plus: 0, total: 0 }
    // A manual 'overdue' without a readable due date is late by definition.
    const late = isISODate(invoice.dueDate) ? todayDay - dayNumber(invoice.dueDate) : (status === 'overdue' ? 1 : 0)
    const key = late <= 0 ? 'notDue' : late <= 30 ? 'd1to30' : late <= 60 ? 'd31to60' : late <= 90 ? 'd61to90' : 'd90plus'
    row[key] = sumMoney([row[key], amount], currency)
    row.total = sumMoney([row.total, amount], currency)
    buckets.set(currency, row)
  }
  return [...buckets.values()]
}

/** Tax summary for a period - an estimate to help prepare a declaration. */
export interface TaxSummaryRow {
  currency: string
  /** Settled sales before tax (credit notes deducted). */
  salesExclTax: number
  /** Tax on those settled sales. */
  taxCollected: number
  /** Recorded expenses before their recorded tax. */
  purchasesExclTax: number
  /** Tax recorded on expenses - potentially deductible; the accountant decides. */
  taxDeductible: number
  /** taxCollected − taxDeductible: positive is owed, negative is a credit. */
  netTax: number
}

/**
 * Built strictly from what happened: documents settled in the period (by
 * their paid date, matching the cash-basis the other reports use) and the
 * tax recorded on expenses dated in the period. It never applies legal
 * rules - the screen labels it as an estimate to verify before filing.
 */
export function taxSummary(
  invoices: Invoice[],
  expenses: Expense[],
  from: string,
  to: string,
  defaultCurrency = getPreferences().defaultCurrency,
): TaxSummaryRow[] {
  const inRange = (date: string) =>
    isISODate(date) && dayNumber(date) >= dayNumber(from) && dayNumber(date) <= dayNumber(to)
  const rows = new Map<string, { sales: number[]; taxIn: number[]; purchases: number[]; taxOut: number[] }>()
  const bucket = (currency: string) => {
    const entry = rows.get(currency) || { sales: [], taxIn: [], purchases: [], taxOut: [] }
    rows.set(currency, entry)
    return entry
  }
  for (const invoice of invoices) {
    if (invoice.status !== 'paid') continue
    if (!inRange(localDateOf(invoice.paidAt ?? invoice.occurredAt ?? invoice.createdAt))) continue
    const sign = documentSign(invoice)
    const entry = bucket(invoice.currency || defaultCurrency)
    entry.sales.push(sign * invoice.subtotal)
    entry.taxIn.push(sign * invoice.tax)
  }
  for (const expense of expenses) {
    const date = isISODate(expense.date) ? expense.date : localDateOf(expense.occurredAt ?? expense.createdAt)
    if (!inRange(date)) continue
    const entry = bucket(expense.currency || defaultCurrency)
    const tax = expense.taxAmount || 0
    entry.purchases.push(expense.amount - tax)
    entry.taxOut.push(tax)
  }
  return [...rows]
    .map(([currency, entry]) => ({
      currency,
      salesExclTax: sumMoney(entry.sales, currency),
      taxCollected: sumMoney(entry.taxIn, currency),
      purchasesExclTax: sumMoney(entry.purchases, currency),
      taxDeductible: sumMoney(entry.taxOut, currency),
      netTax: sumMoney([...entry.taxIn, ...entry.taxOut.map(amount => -amount)], currency),
    }))
    .filter(row => row.salesExclTax !== 0 || row.taxCollected !== 0 || row.purchasesExclTax !== 0 || row.taxDeductible !== 0)
}
