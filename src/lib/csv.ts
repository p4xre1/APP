import { t } from '../i18n'
import { getPreferences, type Language } from './preferences'
import { sessionGuard } from './vault'
import { exportBackup } from './db'
import type { FatoratiBackup } from './db'
import { shareFile } from './share-file'
import { todayISO } from './subscriptions'
import { paymentsTotal, invoiceBalance } from './payments'
import { customerInsights } from './customer-insights'

export type CsvStore = 'customers' | 'invoices' | 'expenses'

export function buildCsv(rows: unknown[][]): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '')
    // Prevent spreadsheet formula injection, including whitespace-prefixed formulas.
    if (typeof value === 'string' && (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text
    return `"${text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function csvRows(store: CsvStore, backup: FatoratiBackup): unknown[][] {
  const currency = backup.preferences.defaultCurrency
  if (store === 'customers') {
    const insights = customerInsights(backup.customers, backup.invoices, currency)
    return [
      // These are computed from invoice history, never the stale legacy balance field.
      // Amount arrays stay grouped by currency so a CSV never adds MAD, USD and EUR together.
      ['ID', 'Name', 'Email', 'Phone', 'Address', 'Country', 'Country name', 'State', 'City', 'Notes', 'Kind', 'Total invoiced', 'Amount paid', 'Unpaid balance', 'Rank', 'Rank amount', 'Rank currency', 'Created At', 'Updated At'],
      ...backup.customers.map(c => {
        const insight = insights.get(c.id)!
        return [
          c.id, c.name, c.email, c.phone, c.address, c.country || '', c.countryName || '', c.state || '', c.city, c.notes,
          c.kind || 'business', JSON.stringify(insight.invoiced), JSON.stringify(insight.received), JSON.stringify(insight.outstanding),
          insight.rank ?? '', insight.rank === null ? '' : insight.rankValue, insight.rank === null ? '' : currency,
          new Date(c.createdAt).toISOString(), new Date(c.updatedAt).toISOString(),
        ]
      }),
    ]
  }
  if (store === 'expenses') return [
    ['ID', 'Description', 'Amount', 'Tax Amount', 'Currency', 'Category', 'Date', 'Date and time', 'Vendor', 'Payment Method', 'Reference', 'Created At', 'Updated At'],
    ...backup.expenses.map(e => [e.id, e.description, e.amount, e.taxAmount ?? 0, e.currency||currency, e.category, e.date, new Date(e.occurredAt||e.createdAt).toISOString(), e.vendor, e.paymentMethod || '', e.reference || '', new Date(e.createdAt).toISOString(), new Date(e.updatedAt).toISOString()]),
  ]
  const names = new Map(backup.customers.map(c => [c.id, c.name]))
  return [
    ['ID', 'Number', 'Customer ID', 'Customer', 'Project ID', 'Status', 'Date and time', 'Issue Date', 'Due Date', 'Subtotal', 'Tax', 'Total', 'Currency', 'Notes', 'Items (JSON)', 'Kind', 'Credits Invoice ID', 'Amount Paid', 'Balance', 'Created At', 'Updated At'],
    ...backup.invoices.map(i => [i.id, i.number, i.customerId, names.get(i.customerId) || '', i.projectId, t(i.status,{},i.language), new Date(i.occurredAt||i.createdAt).toISOString(), i.issueDate, i.dueDate, i.subtotal, i.tax, i.total, i.currency||currency, i.notes, JSON.stringify(i.items), i.kind || 'invoice', i.creditsInvoiceId || '', i.status === 'paid' ? i.total : paymentsTotal(i, currency), invoiceBalance(i, currency), new Date(i.createdAt).toISOString(), new Date(i.updatedAt).toISOString()]),
  ]
}

export async function exportCsv(store: CsvStore, language: Language = getPreferences().language): Promise<void> {
  const guard = sessionGuard(), backup = await exportBackup()
  const rows = csvRows(store,backup)
  rows[0] = rows[0].map(header=>t(String(header),{},language))
  if(store==='invoices') rows.slice(1).forEach((row,index)=>{row[5]=t(backup.invoices[index].status,{},language)})
  guard()
  // The exported file is named after the device's local day, like every date in the app.
  await shareFile(`fatorati-${store}-${todayISO()}.csv`, buildCsv(rows), 'text/csv;charset=utf-8')
}
