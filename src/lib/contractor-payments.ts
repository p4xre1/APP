/**
 * Form 1099-NEC preparation: what the business PAID to each vendor in one year.
 *
 * Money going out is recorded as an Expense (vendor + amount + date), so this is
 * where a contractor's subcontractor payments live. The app groups the recorded
 * expenses and flags the federal threshold; it never decides who must be reported
 * (entity type, card payments and the accountant's basis are outside its scope).
 */
import type { Expense } from '../store/types'

/** Non-employee compensation of 2,000 USD or more in a year (2026 rule, OBBBA). */
export const FORM_1099_THRESHOLD = 2000

export interface ContractorPayment {
  /** Vendor as first spelled by the user (grouping is case- and space-insensitive). */
  vendor: string
  /** Total recorded to that vendor in the year, tax included. */
  total: number
  /** How many expenses were grouped. */
  count: number
  /** True when the total reaches the federal reporting threshold. */
  formDue: boolean
}

/**
 * Groups one calendar year of expenses by vendor, in the currency the report shows.
 * Expenses with no vendor or an unusable date cannot be attributed: they are skipped.
 */
export function contractorPayments(expenses: Expense[], year: number, currency: string): ContractorPayment[] {
  const groups = new Map<string, { vendor: string; total: number; count: number }>()
  for (const expense of expenses) {
    if ((expense.currency || currency) !== currency) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expense.date) || Number(expense.date.slice(0, 4)) !== year) continue
    const vendor = (expense.vendor || '').trim()
    if (!vendor || !Number.isFinite(expense.amount) || expense.amount <= 0) continue
    const key = vendor.toLocaleLowerCase()
    const group = groups.get(key) || { vendor, total: 0, count: 0 }
    group.total += expense.amount
    group.count += 1
    groups.set(key, group)
  }
  return [...groups.values()]
    .map(group => ({ ...group, formDue: group.total >= FORM_1099_THRESHOLD }))
    .sort((a, b) => b.total - a.total || a.vendor.localeCompare(b.vendor))
}
