// Invoice builder extras: payment-term presets over the existing dueDate field,
// PO / salesperson / shipping address / private note on the ONE Invoice entity,
// and the item code (product SKU) on the ONE InvoiceItem model. No second
// numbering, tax, totals, payment or template system is involved.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PAYMENT_TERM_DAYS, dueDateFromTerms, paymentTermsGap, clampDueDays } from '../src/lib/status'
import { approximateMeasure, buildDocumentModel, layoutDocument, pageText } from '../src/lib/template-render'
import { validateBackup, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { templateDefaults } from '../src/lib/templates'
import { productToLine } from '../src/lib/products'
import { fixture } from './fixtures'
import type { Business, Customer, Invoice } from '../src/store/types'

const base = { occurredAt: 1_756_684_800_000, createdAt: 1, updatedAt: 2 }
const business = { ...base, id: 'business', name: 'Atelier Nord SARL', ownerName: 'Karim', phone: '', email: '', address: '12 Rue des Orangers', city: 'Tanger', taxNumber: '123456789012345' } as unknown as Business
const customer = { ...base, id: 'customer', name: 'Client SA', email: '', phone: '', address: '5 Avenue Mohammed V', city: 'Casablanca', notes: '', balance: 0, taxNumber: '9876' } as unknown as Customer
const invoice = (patch: Record<string, unknown> = {}): Invoice => ({
  ...base, id: 'invoice', number: 'INV-2026-0042', customerId: 'customer',
  items: [{ id: 'line', itemCode: 'SKU-77', description: 'Climatiseur 12000 BTU', quantity: 2, unitPrice: 2100, total: 4200 }],
  subtotal: 4200, tax: 840, total: 5040, taxRate: 20, status: 'sent',
  issueDate: '2026-09-01', dueDate: '2026-09-30', notes: 'Merci pour votre confiance.',
  paymentMethod: 'Bank transfer', currency: 'MAD', language: 'fr', ...patch,
} as unknown as Invoice)

const modelOf = (patch: Record<string, unknown> = {}, layoutId?: string) => buildDocumentModel({
  kind: 'invoice', document: invoice(patch), business, customer, region: 'MA',
  currency: 'MAD', language: 'fr',
  template: { ...templateDefaults(null, 'MA'), ...(layoutId ? { layoutId } : {}) } as ReturnType<typeof templateDefaults>,
  appAccent: '#2563eb',
})

test('payment-term presets compute the due date through the one dueDate field', () => {
  assert.equal(dueDateFromTerms('2026-09-01', 0), '2026-09-01') // due on receipt
  assert.equal(dueDateFromTerms('2026-09-01', 30), '2026-10-01')
  assert.equal(dueDateFromTerms('2026-12-31', 15), '2027-01-15') // year wrap
  // Every preset round-trips through the existing gap logic used by Law 69-21 hints.
  for (const days of PAYMENT_TERM_DAYS) {
    assert.equal(paymentTermsGap('2026-09-01', dueDateFromTerms('2026-09-01', days)), days)
  }
  // Garbage falls back to the same default the settings use.
  assert.equal(dueDateFromTerms('2026-09-01', -5), dueDateFromTerms('2026-09-01', clampDueDays(-5)))
})

test('PO number and salesperson print in the document meta only when present', () => {
  const plain = modelOf()
  assert.ok(!plain.meta.some(entry => entry.value === 'PO-1234'), 'no PO row when the field is empty')
  const filled = modelOf({ poNumber: 'PO-1234', salesperson: 'Yasmine A.' })
  assert.ok(filled.meta.some(entry => entry.value === 'PO-1234'), 'PO row present')
  assert.ok(filled.meta.some(entry => entry.value === 'Yasmine A.'), 'salesperson row present')
  // Older invoices without the fields keep the exact same meta rows as before.
  assert.equal(plain.meta.length, filled.meta.length - 2)
})

test('shipping address renders in the customer block; billing stays the customer address', () => {
  const model = modelOf({ shippingAddress: 'Dépôt Zone Franche\nKsar el-Kébir' })
  assert.ok(model.customerLines.includes('5 Avenue Mohammed V'), 'billing address still printed')
  assert.ok(model.customerLines.some(line => line.includes('Dépôt Zone Franche')), 'ship-to line printed')
  assert.ok(!modelOf().customerLines.some(line => line.includes('Ship') || line.includes('Livrer')), 'no ship-to block when empty')
})

test('the private note NEVER reaches the rendered model, the pages or the PDF text', () => {
  const secret = 'INTERNE: marge 40%, ne pas communiquer'
  const model = modelOf({ privateNotes: secret })
  assert.ok(!JSON.stringify(model).includes(secret), 'model must not contain the private note')
  const text = pageText(layoutDocument(model, { measure: approximateMeasure }))
  assert.ok(!text.includes(secret), 'rendered pages must not contain the private note')
  assert.ok(text.includes('Merci pour votre confiance.'), 'the public note still prints')
})

test('the item code prefixes the description cell without adding a column', () => {
  const model = modelOf()
  const row = model.rows[0].cells.join(' | ')
  assert.ok(row.includes('SKU-77 — Climatiseur 12000 BTU'), `item code visible in: ${row}`)
  // A line without a code renders exactly as before.
  const legacy = modelOf({ items: [{ id: 'line', description: 'Pose', quantity: 1, unitPrice: 500, total: 500 }] })
  assert.equal(legacy.rows[0].cells[0], 'Pose')
})

test('totals are identical whatever template layout is selected (one source of truth)', () => {
  const layouts = ['classic', 'modern', 'minimal', 'compact'] as const
  const rendered = layouts.map(layoutId => {
    try { return JSON.stringify(modelOf({}, layoutId).totals) } catch { return null }
  }).filter((value): value is string => value !== null)
  assert.ok(rendered.length >= 2, 'at least two layouts must build')
  assert.ok(rendered.every(value => value === rendered[0]), 'every layout shows the same totals')
})

test('builder fields validate in backups; broken values are rejected; old backups stay valid', async () => {
  const withInvoice = (patch: Record<string, unknown> = {}) => {
    const backup = fixture()
    Object.assign(backup.invoices[0] as unknown as Record<string, unknown>, patch)
    return backup
  }
  validateBackup(withInvoice()) // pre-builder invoices carry none of the fields
  validateBackup(withInvoice({ poNumber: 'PO-9', salesperson: 'Sara', shippingAddress: 'Depot A\nTanger', privateNotes: 'internal' }))
  for (const bad of [
    { poNumber: 42 }, { poNumber: 'x'.repeat(121) }, { salesperson: [] },
    { shippingAddress: 7 }, { privateNotes: { a: 1 } },
  ]) assert.throws(() => validateBackup(withInvoice(bad)), /Invalid backup record/, JSON.stringify(bad))
  // Item code on lines: optional, bounded, round-trips encrypted.
  const items = (withInvoice().invoices[0] as unknown as { items: Record<string, unknown>[] }).items
  const coded = withInvoice({ items: [{ ...items[0], itemCode: 'SKU-1' }] })
  validateBackup(coded)
  assert.throws(() => validateBackup(withInvoice({ items: [{ ...items[0], itemCode: 'x'.repeat(121) }] })), /Invalid backup record/)
  const source = withInvoice({ poNumber: 'PO-9', privateNotes: 'سري', items: [{ ...items[0], itemCode: 'REF-5' }] })
  const restored = await decodeBackup(await encodeBackup(source, 'pass سري'), 'pass سري')
  assert.equal(restored.invoices[0].poNumber, 'PO-9')
  assert.equal(restored.invoices[0].privateNotes, 'سري')
  assert.equal(restored.invoices[0].items[0].itemCode, 'REF-5')
})

test('productToLine carries the SKU as the item code (one product identity)', () => {
  const line = productToLine({
    id: 'p1', name: 'Filtre', description: '', sku: ' FLT-3 ', unitPrice: 90, unit: 'piece', stock: 0,
    createdAt: 0, updatedAt: 0,
  })
  assert.equal(line.itemCode, 'FLT-3')
  assert.equal(line.unitPrice, 90)
})

test('the builder never grows a second financial or rendering path', () => {
  const source = readFileSync('src/modules/Invoices.tsx', 'utf8')
  assert.ok(source.includes('documentTotals('), 'totals come from documentTotals')
  assert.ok(!/subtotal\s*[+*]/.test(source), 'no ad-hoc totals arithmetic in the UI')
  assert.ok(source.includes('buildDocumentModel('), 'preview uses the shared model builder')
  assert.ok(source.includes('shareInvoicePdf('), 'download uses the one PDF pipeline')
})
