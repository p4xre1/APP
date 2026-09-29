import type { Customer, Invoice, Project } from '../store/types'
import type { Language } from './preferences'
import { sumMoney } from './format'

export type GroupMode = 'client' | 'project' | 'month'
export interface GroupRow { key: string; label: string; total: number; count: number; percent: number }

/** Projects are only offered when the invoices really are linked to projects. */
export function hasProjectLinks(invoices: { projectId?: string }[]) {
  return invoices.some(invoice => !!invoice.projectId)
}

export function groupModes(invoices: { projectId?: string }[]): GroupMode[] {
  return hasProjectLinks(invoices) ? ['client', 'project', 'month'] : ['client', 'month']
}

/**
 * Group the invoices behind a revenue number by client, project or month.
 * `percent` is the share of the invoices passed in (never of mixed currencies).
 */
export function groupInvoices(invoices: Invoice[], mode: GroupMode, options: {
  currency: string
  defaultCurrency: string
  customers?: Customer[]
  projects?: Project[]
  language?: Language
  timeZone?: string
  otherLabel?: string
  noProjectLabel?: string
}): GroupRow[] {
  const { currency, defaultCurrency, customers = [], projects = [], language = 'en', timeZone = 'UTC' } = options
  const rows = invoices.filter(invoice => (invoice.currency || defaultCurrency) === currency)
  const overall = sumMoney(rows.map(invoice => invoice.total), currency)
  const groups = new Map<string, { label: string; amounts: number[] }>()
  const monthFormatter = new Intl.DateTimeFormat(language, { month: 'short', year: 'numeric', timeZone, calendar: 'gregory' })
  for (const invoice of rows) {
    let key: string, label: string
    if (mode === 'client') {
      key = invoice.customerId || 'none'
      label = customers.find(customer => customer.id === invoice.customerId)?.name || options.otherLabel || '—'
    } else if (mode === 'project') {
      key = invoice.projectId || 'none'
      label = projects.find(project => project.id === invoice.projectId)?.name || options.noProjectLabel || '—'
    } else {
      const timestamp = invoice.occurredAt ?? invoice.createdAt
      key = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(timestamp)
      label = monthFormatter.format(timestamp)
    }
    const group = groups.get(key) || { label, amounts: [] }
    group.amounts.push(invoice.total)
    groups.set(key, group)
  }
  return [...groups]
    .map(([key, group]) => {
      const total = sumMoney(group.amounts, currency)
      return { key, label: group.label, total, count: group.amounts.length, percent: overall ? total / overall : 0 }
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, language))
}
