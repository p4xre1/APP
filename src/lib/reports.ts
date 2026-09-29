import type { Invoice, Expense } from '../store/types'
import { getPreferences } from './preferences'
import { sumMoney, roundMoney, money } from './format'

/** Paid = counted as revenue. Sent or overdue = pending. Drafts are never counted. */
export const PAID_STATUSES = ['paid'] as const
export const PENDING_STATUSES = ['sent', 'overdue'] as const

export function invoiceCurrency(invoice: Pick<Invoice, 'currency'>, defaultCurrency: string) {
  return invoice.currency || defaultCurrency
}

/** Calendar date (ISO) of the day an invoice was due, compared as a plain date, never an instant. */
export function dueDatePassed(dueDate: string, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false
  return dueDate < today.toISOString().slice(0, 10)
}

/**
 * An invoice is overdue when it is still unpaid and its due date is in the past.
 * Explicit "overdue" records stay overdue regardless of the stored due date.
 */
export function isOverdueInvoice(invoice: Invoice, today = new Date(), _defaultCurrency = getPreferences().defaultCurrency) {
  if (invoice.status === 'paid' || invoice.status === 'draft') return false
  if (invoice.status === 'overdue') return true
  return dueDatePassed(invoice.dueDate, today)
}

export function isPendingInvoice(invoice: Invoice, today = new Date(), defaultCurrency = getPreferences().defaultCurrency) {
  return invoice.status === 'sent' || isOverdueInvoice(invoice, today, defaultCurrency)
}

export interface InvoiceBucket {
  currency: string
  /** Sum of invoices with the paid status. */
  revenue: number
  /** Sum of sent + overdue invoices (overdue included). */
  pending: number
  /** Part of `pending` whose due date has passed. */
  overdue: number
  expenses: number
  profit: number
  counts: { paid: number; pending: number; overdue: number; drafts: number; expenses: number }
  /** Invoice lists behind each number, newest first. */
  invoices: { paid: Invoice[]; pending: Invoice[]; overdue: Invoice[] }
}

/** One place where revenue, pending, overdue and expense totals are defined per currency. */
export function invoiceBucket(invoices: Invoice[], expenses: Expense[], currency: string, defaultCurrency = getPreferences().defaultCurrency, today = new Date()): InvoiceBucket {
  const rows = invoices.filter(row => invoiceCurrency(row, defaultCurrency) === currency)
  const paid = rows.filter(row => row.status === 'paid')
  const pending = rows.filter(row => isPendingInvoice(row, today, defaultCurrency))
  const overdue = rows.filter(row => isOverdueInvoice(row, today, defaultCurrency))
  const spent = expenses.filter(row => (row.currency || defaultCurrency) === currency)
  const revenue = sumMoney(paid.map(row => row.total), currency)
  const pendingTotal = sumMoney(pending.map(row => row.total), currency)
  const overdueTotal = sumMoney(overdue.map(row => row.total), currency)
  const expenseTotal = sumMoney(spent.map(row => row.amount), currency)
  const byDate = (list: Invoice[]) => [...list].sort((a, b) => (b.occurredAt ?? b.createdAt) - (a.occurredAt ?? a.createdAt))
  return {
    currency, revenue, pending: pendingTotal, overdue: overdueTotal, expenses: expenseTotal,
    profit: sumMoney([revenue, -expenseTotal], currency),
    counts: {
      paid: paid.length, pending: pending.length, overdue: overdue.length,
      drafts: rows.filter(row => row.status === 'draft').length, expenses: spent.length,
    },
    invoices: { paid: byDate(paid), pending: byDate(pending), overdue: byDate(overdue) },
  }
}

export function totalsByCurrency(rows: {currency?:string;amount:number}[]) {
  const groups=new Map<string,number[]>()
  for(const row of rows){const currency=row.currency||getPreferences().defaultCurrency;groups.set(currency,[...(groups.get(currency)||[]),row.amount])}
  return [...groups].map(([currency,amounts])=>({currency,total:sumMoney(amounts,currency)}))
}
export function groupedMoney(rows:{currency?:string;amount:number}[]) {
  const totals=totalsByCurrency(rows)
  return totals.length?totals.map(row=>money(row.total,row.currency)).join(' · '):money(0)
}
export function reportTotals(invoices:Invoice[],expenses:Expense[],defaultCurrency=getPreferences().defaultCurrency,today=new Date()) {
  const currencies=[...new Set([...invoices,...expenses].map(row=>row.currency||defaultCurrency))]
  const totals=currencies.map(currency=>{
    const bucket=invoiceBucket(invoices,expenses,currency,defaultCurrency,today)
    return {currency,revenue:bucket.revenue,pending:bucket.pending,overdue:bucket.overdue,expenses:bucket.expenses,profit:bucket.profit,counts:bucket.counts,breakdown:bucket.invoices}
  })
  let missing=0
  const converted:number[]=[]
  for(const row of [...invoices.filter(row=>row.status==='paid'),...expenses]) {
    const amount='total' in row?row.total:-row.amount
    if((row.currency||defaultCurrency)===defaultCurrency)converted.push(amount)
    else if(row.exchangeRate && row.rateCurrency===defaultCurrency)converted.push(roundMoney(amount*row.exchangeRate,defaultCurrency))
    else missing++
  }
  return {totals,converted:sumMoney(converted,defaultCurrency),missing}
}
