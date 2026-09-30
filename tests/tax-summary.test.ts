// Tax summary: an estimate built strictly from settled documents and the tax
// recorded on expenses - the app never applies legal rules.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { taxSummary } from '../src/lib/reports'
import type { Invoice, Expense } from '../src/store/types'

const invoice = (patch: Partial<Invoice>): Invoice => ({
  id: patch.number || 'inv', number: 'INV-1', customerId: 'c1', items: [], notes: '',
  subtotal: 1000, tax: 200, total: 1200, status: 'paid', currency: 'MAD',
  paidAt: Date.parse('2026-09-10T12:00:00'),
  issueDate: '2026-09-01', dueDate: '2026-09-30', occurredAt: 0, createdAt: 0, updatedAt: 0, ...patch,
} as Invoice)
const expense = (patch: Partial<Expense>): Expense => ({
  id: `${patch.description || 'e'}-${patch.date}`, description: 'x', category: 'other', vendor: '',
  amount: 120, date: '2026-09-15', currency: 'MAD', occurredAt: 0, createdAt: 0, updatedAt: 0, ...patch,
} as Expense)

test('collected, deductible and net from real transactions only', () => {
  const invoices = [
    invoice({ number: 'a' }),                                        // sales 1000, tax 200
    invoice({ number: 'unpaid', status: 'sent', paidAt: undefined }), // not settled: excluded
    invoice({ number: 'av', kind: 'credit_note', subtotal: 100, tax: 20, total: 120 }), // subtracts
  ]
  const expenses = [
    expense({ description: 'with-tax', amount: 120, taxAmount: 20 }),
    expense({ description: 'no-tax', amount: 50 }), // all purchase, nothing deductible
  ]
  const [row] = taxSummary(invoices, expenses, '2026-09-01', '2026-09-30', 'MAD')
  assert.equal(row.salesExclTax, 900)        // 1000 − 100
  assert.equal(row.taxCollected, 180)        // 200 − 20
  assert.equal(row.purchasesExclTax, 150)    // (120−20) + 50
  assert.equal(row.taxDeductible, 20)
  assert.equal(row.netTax, 160)              // 180 − 20
})

test('the period fences by settle date for sales and expense date for purchases', () => {
  const invoices = [invoice({ number: 'aug', paidAt: Date.parse('2026-08-31T12:00:00') })]
  const expenses = [expense({ date: '2026-10-01', taxAmount: 10 })]
  assert.deepEqual(taxSummary(invoices, expenses, '2026-09-01', '2026-09-30', 'MAD'), [])
  const [august] = taxSummary(invoices, expenses, '2026-08-01', '2026-08-31', 'MAD')
  assert.equal(august.taxCollected, 200)
  assert.equal(august.taxDeductible, 0)
})

test('a net credit comes out negative and currencies never mix', () => {
  const invoices = [invoice({ number: 'a', subtotal: 100, tax: 10, total: 110 })]
  const expenses = [
    expense({ amount: 600, taxAmount: 100 }),
    expense({ description: 'usd', currency: 'USD', amount: 60, taxAmount: 10 }),
  ]
  const rows = taxSummary(invoices, expenses, '2026-09-01', '2026-09-30', 'MAD')
  const mad = rows.find(row => row.currency === 'MAD')!
  const usd = rows.find(row => row.currency === 'USD')!
  assert.equal(mad.netTax, -90) // 10 collected − 100 deductible: a credit
  assert.equal(usd.taxDeductible, 10)
})

test('an empty period summarizes to nothing', () => {
  assert.deepEqual(taxSummary([], [], '2026-01-01', '2026-12-31', 'MAD'), [])
})
