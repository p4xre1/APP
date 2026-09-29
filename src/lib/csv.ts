import { t } from '../i18n'
import { getPreferences, type Language } from './preferences'
import { sessionGuard } from './vault'
import { exportBackup } from './db'
import type { FatoratiBackup } from './db'
import { shareFile } from './share-file'
import { encodeProtectedExport, EXPORT_EXTENSION } from './export-crypto'
import { confirmPlaintextExport } from './export-warning'

export type CsvStore = 'customers' | 'invoices' | 'estimates' | 'expenses'

export function buildCsv(rows: unknown[][]): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '')
    // Prevent spreadsheet formula injection, including whitespace-prefixed formulas.
    if (typeof value === 'string' && (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text
    return `"${text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

const documentRows = (store: 'invoices' | 'estimates', backup: FatoratiBackup) => {
  const currency = backup.preferences.defaultCurrency
  const names = new Map(backup.customers.map(c => [c.id, c.name]))
  const documents = backup[store] as unknown as { id: string; number: string; customerId: string; projectId?: string; status: string; language?: string; occurredAt?: number; createdAt: number; updatedAt: number; issueDate: string; dueDate?: string; expiryDate?: string; subtotal: number; tax: number; total: number; currency?: string; notes: string; items: unknown }[]
  return [
    ['ID', 'Number', 'Customer ID', 'Customer', 'Project ID', 'Status', 'Date and time', 'Issue Date', store === 'invoices' ? 'Due Date' : 'Expiry Date', 'Subtotal', 'Tax', 'Total', 'Currency', 'Notes', 'Items (JSON)', 'Created At', 'Updated At'],
    ...documents.map(d => [d.id, d.number, d.customerId, names.get(d.customerId) || '', d.projectId, t(d.status, {}, (d.language || backup.preferences.language) as Language), new Date(d.occurredAt || d.createdAt).toISOString(), d.issueDate, store === 'invoices' ? d.dueDate : d.expiryDate, d.subtotal, d.tax, d.total, d.currency || currency, d.notes, JSON.stringify(d.items), new Date(d.createdAt).toISOString(), new Date(d.updatedAt).toISOString()]),
  ]
}

export function csvRows(store: CsvStore, backup: FatoratiBackup): unknown[][] {
  const currency = backup.preferences.defaultCurrency
  if (store === 'customers') return [
    ['ID', 'Name', 'Email', 'Phone', 'Address', 'City', 'Notes', 'Balance', 'Currency', 'Created At', 'Updated At'],
    ...backup.customers.map(c => [c.id, c.name, c.email, c.phone, c.address, c.city, c.notes, c.balance, currency, new Date(c.createdAt).toISOString(), new Date(c.updatedAt).toISOString()]),
  ]
  if (store === 'expenses') return [
    ['ID', 'Description', 'Amount', 'Currency', 'Category', 'Date', 'Date and time', 'Vendor', 'Created At', 'Updated At'],
    ...backup.expenses.map(e => [e.id, e.description, e.amount, e.currency||currency, e.category, e.date, new Date(e.occurredAt||e.createdAt).toISOString(), e.vendor, new Date(e.createdAt).toISOString(), new Date(e.updatedAt).toISOString()]),
  ]
  return documentRows(store, backup)
}

async function shareCsv(name: string, csv: string, password?: string): Promise<void> {
  if (password !== undefined) {
    if (!password) throw new Error('Enter a password to protect this export')
    const container = await encodeProtectedExport(csv, { password, kind: 'csv', filename: name })
    return shareFile(`${name}${EXPORT_EXTENSION}`, container, 'application/octet-stream')
  }
  await confirmPlaintextExport()
  await shareFile(name, csv, 'text/csv;charset=utf-8')
}

function localizedCsv(store: CsvStore, rows: unknown[][], backup: FatoratiBackup, language: Language): unknown[][] {
  const table = rows.map(row => [...row])
  table[0] = table[0].map(header => t(String(header), {}, language))
  if (store === 'invoices' || store === 'estimates') {
    // Column 5 is Status; translate it into the language chosen for this export.
    const documents = backup[store] as unknown as { status: string }[]
    table.slice(1).forEach((row, index) => { row[5] = t(documents[index].status, {}, language) })
  }
  return table
}

export async function exportCsv(store: CsvStore, language: Language = getPreferences().language, password?: string): Promise<void> {
  const guard = sessionGuard(), backup = await exportBackup()
  const table = localizedCsv(store, csvRows(store, backup), backup, language)
  guard()
  await shareCsv(`fatorati-${store}-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(table), password)
}

/** One document only, for accountants who need the line items of a single invoice. */
export async function exportDocumentCsv(store: 'invoices' | 'estimates', id: string, language: Language = getPreferences().language, password?: string): Promise<void> {
  const guard = sessionGuard(), backup = await exportBackup()
  const table = localizedCsv(store, csvRows(store, backup), backup, language).filter((row, index) => index === 0 || row[0] === id)
  if (table.length < 2) throw new Error('Record not found')
  guard()
  const documents = backup[store] as unknown as { id: string; number: string }[]
  await shareCsv(`${documents.find(row => row.id === id)?.number || store}-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(table), password)
}
