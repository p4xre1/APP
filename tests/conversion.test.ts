// Estimate → invoice conversion: happens once, only from sent/accepted, and the
// invoice inherits everything the customer already saw on the estimate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canConvertEstimate, invoiceFromEstimate } from '../src/lib/convert'
import { validateBackup, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { fixture } from './fixtures'
import type { Estimate } from '../src/store/types'
import type { FatoratiBackup } from '../src/lib/db'

const estimate: Estimate = {
  id: 'est-1', number: 'EST-2026-0001', customerId: 'cust-1', projectId: 'proj-1',
  items: [{ id: 'item-1', description: 'Design «Café»', quantity: 2, unitPrice: 50, total: 100, unit: 'day' }],
  subtotal: 100, tax: 20, total: 120,
  status: 'sent', issueDate: '2026-09-01', expiryDate: '2026-10-01', notes: 'Merci',
  currency: 'MAD', language: 'fr', taxRate: 20, exchangeRate: 0.1, rateCurrency: 'USD',
  paymentMethod: 'Virement bancaire', pdfColor: true,
  template: { layoutId: 'classic', presetId: 'general', templateVersion: 1, accent: 'auto', labels: { quantity: 'Qté' }, region: 'MA' },
  createdAt: 1, updatedAt: 1,
}

test('conversion is allowed only once and only from sent or accepted', () => {
  assert.equal(canConvertEstimate({ status: 'draft' }), false)
  assert.equal(canConvertEstimate({ status: 'sent' }), true)
  assert.equal(canConvertEstimate({ status: 'accepted' }), true)
  assert.equal(canConvertEstimate({ status: 'declined' }), false)
  // Already converted: never again, whatever the status says.
  assert.equal(canConvertEstimate({ status: 'accepted', convertedInvoiceId: 'inv-9' }), false)
})

test('the draft invoice copies template, payment method, project and money fields', () => {
  const invoice = invoiceFromEstimate(estimate, 'INV-2026-0004', '2026-09-30', '2026-10-30')
  assert.equal(invoice.number, 'INV-2026-0004')
  assert.equal(invoice.status, 'draft')
  assert.equal(invoice.issueDate, '2026-09-30')
  assert.equal(invoice.dueDate, '2026-10-30')
  // The three fields the old conversion dropped.
  assert.deepEqual(invoice.template, estimate.template)
  assert.equal(invoice.paymentMethod, 'Virement bancaire')
  assert.equal(invoice.projectId, 'proj-1')
  // Money, language and rate fields travel unchanged.
  assert.equal(invoice.customerId, 'cust-1')
  assert.equal(invoice.currency, 'MAD')
  assert.equal(invoice.language, 'fr')
  assert.equal(invoice.taxRate, 20)
  assert.equal(invoice.exchangeRate, 0.1)
  assert.equal(invoice.rateCurrency, 'USD')
  assert.equal(invoice.pdfColor, true)
  assert.deepEqual([invoice.subtotal, invoice.tax, invoice.total], [100, 20, 120])
  assert.equal(invoice.notes, 'Merci')
  // Items are equal in content but carry fresh ids.
  assert.equal(invoice.items.length, 1)
  const { id: _, ...copied } = invoice.items[0]
  const { id: __, ...original } = estimate.items[0]
  assert.deepEqual(copied, original)
  assert.notEqual(invoice.items[0].id, estimate.items[0].id)
})

test('the template snapshot is a deep copy, not a shared reference', () => {
  const invoice = invoiceFromEstimate(estimate, 'INV-2026-0005', '2026-09-30', '2026-10-30')
  assert.notEqual(invoice.template, estimate.template)
  invoice.template!.labels.quantity = 'Qty'
  assert.equal(estimate.template!.labels.quantity, 'Qté')
})

test('convertedInvoiceId is validated and survives an encrypted round-trip', async () => {
  const source = fixture() as unknown as FatoratiBackup & { estimates: Record<string, unknown>[] }
  source.estimates[0].convertedInvoiceId = 'inv-1'
  validateBackup(source)
  assert.deepEqual(await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é'), source)
  source.estimates[0].convertedInvoiceId = 7 as unknown as string // not a string
  assert.throws(() => validateBackup(source), /Invalid backup record/)
})
