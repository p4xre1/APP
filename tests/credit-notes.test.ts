// Credit notes are invoices with kind='credit_note': same store, same numbering
// machinery (own AV series), same renderer. Amounts stay positive; every
// aggregate applies documentSign, so there is exactly one subtraction rule.
// Issued documents lock the fields history depends on.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { documentSign, isCreditNote, creditNoteFromInvoice, lockedFieldChanged, CREDIT_NOTE_FALLBACK_PREFIX } from '../src/lib/credit-notes'
import { nextDocumentNumber, seriesFloor } from '../src/lib/fatorati'
import { reportTotals } from '../src/lib/reports'
import { customerOutstanding } from '../src/lib/status'
import { collectCalendarItems } from '../src/lib/calendar'
import { csvRows } from '../src/lib/csv'
import { validateBackup, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { buildDocumentModel, mandatoryFields as _mf } from '../src/lib/template-render'
import { normalizeTemplate } from '../src/lib/templates'
import { t } from '../src/i18n'
import { fixture } from './fixtures'
import type { Invoice, Expense } from '../src/store/types'
import type { FatoratiBackup } from '../src/lib/db'

const TODAY = '2026-09-30'
const base = {
  customerId: 'c1', items: [], notes: '', currency: 'MAD',
  issueDate: '2026-09-01', dueDate: '2026-12-31', occurredAt: 0, createdAt: 0, updatedAt: 0,
}
const invoice = (patch: Partial<Invoice>): Invoice => ({
  ...base, id: patch.number || 'inv', number: 'INV-2026-0001', status: 'paid',
  subtotal: 100, tax: 20, total: 120, paidAt: Date.UTC(2026, 8, 10), ...patch,
} as Invoice)

test('sign and kind: missing kind means invoice, credit notes subtract', () => {
  assert.equal(isCreditNote({ kind: undefined }), false)
  assert.equal(isCreditNote({ kind: 'invoice' }), false)
  assert.equal(isCreditNote({ kind: 'credit_note' }), true)
  assert.equal(documentSign({ kind: undefined }), 1)
  assert.equal(documentSign({ kind: 'credit_note' }), -1)
})

test('a settled credit note subtracts revenue, tax and cash in its own period', () => {
  const rows = [
    invoice({ number: 'INV-2026-0001' }),                                     // paid 120 incl. 20 tax
    invoice({ number: 'INV-2026-0002', status: 'sent' }),                     // owed 120
    invoice({ number: 'AV-2026-0001', kind: 'credit_note', creditsInvoiceId: 'INV-2026-0001', subtotal: 50, tax: 10, total: 60 }), // settled credit note
  ]
  const [row] = reportTotals(rows, [] as Expense[], 'MAD', TODAY).totals
  assert.equal(row.revenue, 50)   // 100 − 50
  assert.equal(row.tax, 10)       // 20 − 10
  assert.equal(row.received, 60)  // 120 − 60
  assert.equal(row.pending, 120)  // the sent invoice, untouched
  // Reconciliation still holds after the subtraction.
  assert.equal(row.revenue + row.tax, row.received)
  // Counts describe invoices; the credit note is a correction, not a document count.
  assert.deepEqual(row.counts, { paid: 1, sent: 1, overdue: 0, draft: 0, total: 2 })
})

test('an open credit note reduces receivables and the customer outstanding', () => {
  const rows = [
    invoice({ number: 'INV-2026-0002', status: 'sent' }),                     // owed 120
    invoice({ number: 'AV-2026-0002', kind: 'credit_note', status: 'sent', subtotal: 25, tax: 5, total: 30 }),
  ]
  const [row] = reportTotals(rows, [], 'MAD', TODAY).totals
  assert.equal(row.pending, 90) // 120 − 30
  assert.deepEqual(customerOutstanding(rows, 'c1', 'MAD', TODAY), [{ currency: 'MAD', amount: 90 }])
  // A draft credit note counts nowhere yet.
  const withDraft = [...rows, invoice({ number: 'AV-2026-0003', kind: 'credit_note', status: 'draft', total: 999 })]
  assert.deepEqual(customerOutstanding(withDraft, 'c1', 'MAD', TODAY), [{ currency: 'MAD', amount: 90 }])
})

test('the draft credit note copies the invoice and never touches the original', () => {
  const original = invoice({ number: 'INV-2026-0007', status: 'paid', taxRate: 20, paymentMethod: 'Bank transfer', projectId: 'p1',
    items: [{ id: 'i1', description: 'Design', quantity: 1, unitPrice: 100, total: 100 }] })
  const note = creditNoteFromInvoice(original, 'AV-2026-0001', TODAY)
  assert.equal(note.kind, 'credit_note')
  assert.equal(note.creditsInvoiceId, original.id)
  assert.equal(note.status, 'draft')
  assert.equal(note.number, 'AV-2026-0001')
  assert.deepEqual([note.subtotal, note.tax, note.total], [100, 20, 120], 'amounts stay positive')
  assert.equal(note.paymentMethod, 'Bank transfer')
  assert.equal(note.projectId, 'p1')
  assert.notEqual(note.items[0].id, 'i1', 'fresh item ids')
  assert.equal(note.items[0].description, 'Design')
  assert.equal(original.status, 'paid', 'original untouched')
})

test('credit notes number in their own gap-free AV series', () => {
  const date = new Date('2026-09-30T10:00:00')
  const numbers = ['INV-2026-0004', 'AV-2026-0001']
  assert.equal(nextDocumentNumber(numbers, 'AV', CREDIT_NOTE_FALLBACK_PREFIX, date, 0), 'AV-2026-0002')
  // The shared floor map protects the AV series exactly like the others.
  assert.equal(nextDocumentNumber(['INV-2026-0004'], 'AV', 'AV', date, seriesFloor({ 'AV-2026': 3 }, 'AV', 'AV', date)), 'AV-2026-0004')
})

test('issued documents lock the fields history depends on', () => {
  const issued = invoice({ number: 'INV-2026-0009', status: 'sent',
    items: [{ id: 'i1', description: 'Design', quantity: 1, unitPrice: 100, total: 100 }] })
  // Drafts are never locked.
  assert.equal(lockedFieldChanged({ ...issued, status: 'draft' }, { total: 999 }), null)
  // Money, identity and numbering are locked once issued.
  assert.equal(lockedFieldChanged(issued, { total: 999 }), 'total')
  assert.equal(lockedFieldChanged(issued, { customerId: 'other' }), 'customerId')
  assert.equal(lockedFieldChanged(issued, { number: 'INV-2026-0999' }), 'number')
  assert.equal(lockedFieldChanged(issued, { issueDate: '2020-01-01' }), 'issueDate')
  assert.equal(lockedFieldChanged(issued, { items: [] }), 'items')
  // What happens to the document stays editable.
  assert.equal(lockedFieldChanged(issued, { status: 'paid', paidAt: 1 }), null)
  assert.equal(lockedFieldChanged(issued, { dueDate: '2027-01-31', notes: 'reminder sent', paymentMethod: 'Cash' }), null)
  // A full-form save that changes nothing is safe: same values, regenerated item ids.
  assert.equal(lockedFieldChanged(issued, {
    total: 120, subtotal: 100, tax: 20, customerId: 'c1', currency: 'MAD', issueDate: '2026-09-01',
    items: [{ id: 'regenerated', description: 'Design', quantity: 1, unitPrice: 100, total: 100 }],
  }), null)
  // A missing tax rate and an explicit 0 are the same document.
  assert.equal(lockedFieldChanged(invoice({ status: 'sent', taxRate: undefined }), { taxRate: 0 }), null)
})

test('credit notes never appear in the calendar', () => {
  const items = collectCalendarItems({
    notes: [], subscriptions: [], estimates: [],
    invoices: [
      invoice({ number: 'INV-2026-0010', status: 'sent' }),
      invoice({ number: 'AV-2026-0004', kind: 'credit_note', status: 'sent' }),
    ],
  }, { today: TODAY })
  const numbers = items.map(item => item.id)
  assert.ok(numbers.includes('INV-2026-0010'))
  assert.equal(numbers.includes('AV-2026-0004'), false)
})

test('the printed document is titled Credit note (fr: Avoir)', () => {
  const template = normalizeTemplate({ layoutId: 'classic', presetId: 'general', region: 'MA' }, 'MA')
  const note = invoice({ number: 'AV-2026-0001', kind: 'credit_note', language: 'fr' })
  const model = buildDocumentModel({ kind: 'credit_note', document: note, business: null, region: 'MA', currency: 'MAD', language: 'fr', template, appAccent: '#2563eb' })
  assert.equal(model.title, t('Credit note', {}, 'fr'))
  assert.equal(t('Credit note', {}, 'fr'), 'Avoir')
})

test('backup: kind and creditsInvoiceId validated, round-trip, legacy files unaffected', async () => {
  const source = fixture() as unknown as FatoratiBackup & { invoices: Record<string, unknown>[] }
  source.invoices[0].kind = 'credit_note'
  source.invoices[0].creditsInvoiceId = 'inv-0'
  validateBackup(source)
  assert.deepEqual(await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é'), source)
  const rawInvoices = source.invoices as unknown as Record<string, unknown>[]
  rawInvoices[0].kind = 'refund' // unknown kind
  assert.throws(() => validateBackup(source), /Invalid backup record/)
  rawInvoices[0].kind = 'credit_note'
  rawInvoices[0].creditsInvoiceId = 7 // not a string
  assert.throws(() => validateBackup(source), /Invalid backup record/)
  // A record without the fields (every pre-2.2 backup) stays valid.
  delete source.invoices[0].kind
  delete source.invoices[0].creditsInvoiceId
  validateBackup(source)
  // Settings prefix: normalized uppercase alphanumerics only.
  const settings = (source as unknown as { settings: Record<string, unknown>[] }).settings
  settings[0].creditNotePrefix = 'AV'
  validateBackup(source)
  settings[0].creditNotePrefix = 'av-!'
  assert.throws(() => validateBackup(source), /Invalid backup record/)
  delete settings[0].creditNotePrefix
})

test('CSV invoices export carries Kind and the corrected invoice id', () => {
  const source = fixture() as unknown as FatoratiBackup & { invoices: Record<string, unknown>[] }
  source.invoices[0].kind = 'credit_note'
  source.invoices[0].creditsInvoiceId = 'inv-0'
  const rows = csvRows('invoices', source)
  const header = rows[0] as string[]
  const kindIndex = header.indexOf('Kind')
  const creditsIndex = header.indexOf('Credits Invoice ID')
  assert.ok(kindIndex >= 0 && creditsIndex >= 0)
  assert.equal((rows[1] as string[])[kindIndex], 'credit_note')
  assert.equal((rows[1] as string[])[creditsIndex], 'inv-0')
  // A legacy invoice exports as kind 'invoice' with an empty link.
  delete source.invoices[0].kind
  delete source.invoices[0].creditsInvoiceId
  const legacy = csvRows('invoices', source)
  assert.equal((legacy[1] as string[])[kindIndex], 'invoice')
  assert.equal((legacy[1] as string[])[creditsIndex], '')
})
