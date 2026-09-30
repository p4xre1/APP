// Expense accounting fields (taxAmount / paymentMethod / reference):
// backup validation, normalization rounding, CSV export.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateBackup, normalizeRecord, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { csvRows } from '../src/lib/csv'
import { fixture } from './fixtures'

const expenseRow = (patch: Record<string, unknown> = {}) => ({
  id: 'e1', description: 'Fuel', amount: 120, category: 'transport', date: '2026-09-10',
  vendor: 'Afriquia', currency: 'EUR', language: 'en', occurredAt: 100, createdAt: 1, updatedAt: 1, ...patch,
})

// The shared fixture with its expense swapped for one carrying the new fields.
const withExpense = (patch: Record<string, unknown> = {}) => {
  const backup = fixture()
  backup.expenses = [expenseRow(patch) as unknown as (typeof backup.expenses)[number]]
  return backup
}

test('valid new expense fields pass; broken ones are rejected', () => {
  validateBackup(withExpense({ taxAmount: 20, paymentMethod: 'card', reference: 'RCPT-9' }))
  validateBackup(withExpense()) // all three optional: old data stays valid
  for (const bad of [
    { taxAmount: 'x' },            // not a number
    { taxAmount: -1 },             // negative
    { taxAmount: 121 },            // more tax than amount
    { paymentMethod: 42 },         // not a string
    { reference: {} },             // not a string
  ]) assert.throws(() => validateBackup(withExpense(bad)), /Invalid backup record/)
})

test('normalizeRecord rounds the tax amount like every other money field', () => {
  const row = normalizeRecord('expenses', expenseRow({ taxAmount: 19.999 }), 'EUR')
  assert.equal(row.taxAmount, 20)
  assert.equal(normalizeRecord('expenses', expenseRow(), 'EUR').taxAmount, undefined)
})

test('the new fields survive a backup round-trip', async () => {
  const source = withExpense({ taxAmount: 20, paymentMethod: 'virement', reference: 'FAC-77' })
  const restored = await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é')
  const [expense] = restored.expenses
  assert.equal(expense.taxAmount, 20)
  assert.equal(expense.paymentMethod, 'virement')
  assert.equal(expense.reference, 'FAC-77')
})

test('the expenses CSV carries tax amount, payment method and reference', () => {
  const [header, row] = csvRows('expenses', withExpense({ taxAmount: 20, paymentMethod: 'card', reference: 'R-1' }))
  assert.equal(row[header.indexOf('Tax Amount')], 20)
  assert.equal(row[header.indexOf('Payment Method')], 'card')
  assert.equal(row[header.indexOf('Reference')], 'R-1')
  // Old expenses without the fields export zeros/blanks, not undefined.
  const [header2, row2] = csvRows('expenses', withExpense())
  assert.equal(row2[header2.indexOf('Tax Amount')], 0)
  assert.equal(row2[header2.indexOf('Payment Method')], '')
})
