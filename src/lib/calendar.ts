import type { Customer, Estimate, Invoice, Project } from '../store/types'
import type { Language } from './preferences'
import { sumMoney } from './format'
import { isOverdueInvoice } from './reports'

/** Calendar days are ISO date-only strings; timestamps are converted with the selected zone. */
export type CalendarEventKind = 'invoice-due' | 'estimate-expiry' | 'payment'

export interface CalendarEvent {
  id: string
  kind: CalendarEventKind
  date: string
  recordId: string
  number: string
  party: string
  project?: string
  amount: number
  currency: string
  language?: Language
  status: string
  overdue: boolean
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}
export function monthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}
export function addMonths(key: string, step: number) {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(Date.UTC(year, month - 1 + step, 1, 12)))
}
/** Local calendar day of a UTC timestamp in the selected zone. */
export function timestampDateKey(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp)
}
/** Week-aligned grid for a month: ISO dates plus null padding cells. */
export function monthGrid(month: string, firstDay: number): (string | null)[] {
  const [year, m] = month.split('-').map(Number)
  const leading = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() - firstDay + 7) % 7
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate()
  const cells: (string | null)[] = Array.from({ length: leading }, () => null)
  for (let day = 1; day <= days; day++) cells.push(`${month}-${String(day).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  return cells
}
export function monthLabel(month: string, language: Language, digits = 'latn') {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat(`${language}-u-nu-${digits}`, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, m - 1, 1, 12)))
}

export interface CalendarSource {
  invoices: Invoice[]
  estimates: Estimate[]
  customers?: Customer[]
  projects?: Project[]
  defaultCurrency: string
  today?: string
  timeZone?: string
}

/** Due dates, estimate expiry dates and payment dates (paid invoices), ready for a month view. */
export function calendarEvents({ invoices, estimates, customers = [], projects = [], defaultCurrency, today = dateKey(new Date()), timeZone = 'UTC' }: CalendarSource): CalendarEvent[] {
  const party = (id: string) => customers.find(row => row.id === id)?.name || ''
  const project = (id?: string) => id ? projects.find(row => row.id === id)?.name : undefined
  const events: CalendarEvent[] = []
  const todayDate = new Date(`${today}T12:00:00Z`)
  for (const invoice of invoices) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.dueDate)) continue
    // Same rule as the revenue cards: unpaid past due (or explicitly overdue), never drafts.
    const overdue = isOverdueInvoice(invoice, todayDate, defaultCurrency)
    events.push({
      id: `invoice-due:${invoice.id}`, kind: 'invoice-due', date: invoice.dueDate, recordId: invoice.id,
      number: invoice.number, party: party(invoice.customerId), project: project(invoice.projectId),
      amount: invoice.total, currency: invoice.currency || defaultCurrency, language: invoice.language,
      status: invoice.status, overdue,
    })
    if (invoice.status === 'paid') {
      const paidAt = invoice.paidAt ?? invoice.occurredAt ?? invoice.createdAt
      events.push({
        id: `payment:${invoice.id}`, kind: 'payment', date: timestampDateKey(paidAt, timeZone), recordId: invoice.id,
        number: invoice.number, party: party(invoice.customerId), project: project(invoice.projectId),
        amount: invoice.total, currency: invoice.currency || defaultCurrency, language: invoice.language,
        status: invoice.status, overdue: false,
      })
    }
  }
  for (const estimate of estimates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(estimate.expiryDate)) continue
    const open = estimate.status !== 'accepted' && estimate.status !== 'declined'
    events.push({
      id: `estimate-expiry:${estimate.id}`, kind: 'estimate-expiry', date: estimate.expiryDate, recordId: estimate.id,
      number: estimate.number, party: party(estimate.customerId), project: project(estimate.projectId),
      amount: estimate.total, currency: estimate.currency || defaultCurrency, language: estimate.language,
      status: estimate.status, overdue: open && estimate.expiryDate < today,
    })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
}

export function eventsByDate(events: CalendarEvent[]) {
  const grouped = new Map<string, CalendarEvent[]>()
  for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) || []), event])
  return grouped
}

/** Amount per currency for one day, never mixing currencies. */
export function dayTotals(events: CalendarEvent[]) {
  const groups = new Map<string, number[]>()
  for (const event of events) groups.set(event.currency, [...(groups.get(event.currency) || []), event.amount])
  return [...groups].map(([currency, amounts]) => ({ currency, total: sumMoney(amounts, currency), count: amounts.length }))
}
