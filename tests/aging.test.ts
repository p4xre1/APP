// Aged receivables: the same open balances the other reports use, bucketed by
// days past the due date.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agedReceivables } from '../src/lib/reports'
import type { Invoice, InvoicePayment } from '../src/store/types'

const TODAY = '2026-09-30'
const invoice = (patch: Partial<Invoice>): Invoice => ({
  id: patch.number || 'inv', number: 'INV-1', customerId: 'c1', items: [], notes: '',
  subtotal: 100, tax: 0, total: 100, status: 'sent', currency: 'MAD',
  issueDate: '2026-01-01', dueDate: '2026-10-15', occurredAt: 0, createdAt: 0, updatedAt: 0, ...patch,
} as Invoice)

test('buckets split exactly at 0/30/60/90 days past due', () => {
  const rows = [
    invoice({ number: 'a', dueDate: '2026-09-30' }),  // due today: not due yet
    invoice({ number: 'b', dueDate: '2026-10-15' }),  // future: not due yet
    invoice({ number: 'c', dueDate: '2026-09-29' }),  // 1 day late
    invoice({ number: 'd', dueDate: '2026-08-31' }),  // 30 days late
    invoice({ number: 'e', dueDate: '2026-08-30' }),  // 31 days late
    invoice({ number: 'f', dueDate: '2026-08-01' }),  // 60 days late
    invoice({ number: 'g', dueDate: '2026-07-31' }),  // 61 days late
    invoice({ number: 'h', dueDate: '2026-07-02' }),  // 90 days late
    invoice({ number: 'i', dueDate: '2026-07-01' }),  // 91 days late
    invoice({ number: 'j', dueDate: '2026-01-01' }),  // long overdue
  ]
  const [aged] = agedReceivables(rows, 'MAD', TODAY)
  assert.equal(aged.notDue, 200)
  assert.equal(aged.d1to30, 200)   // c + d
  assert.equal(aged.d31to60, 200)  // e + f
  assert.equal(aged.d61to90, 200)  // g + h
  assert.equal(aged.d90plus, 200)  // i + j
  assert.equal(aged.total, 1000)
})

test('paid and draft documents never age; partial payments shrink the bucket', () => {
  const payments: InvoicePayment[] = [{ id: 'p1', amount: 70, date: '2026-09-01' }]
  const rows = [
    invoice({ number: 'a', dueDate: '2026-09-01', payments }),          // 29 days late, owes 30
    invoice({ number: 'b', status: 'paid' }),
    invoice({ number: 'c', status: 'draft', dueDate: '2020-01-01' }),
  ]
  const [aged] = agedReceivables(rows, 'MAD', TODAY)
  assert.equal(aged.d1to30, 30)
  assert.equal(aged.total, 30)
})

test('credit notes subtract inside their bucket; currencies stay separate', () => {
  const rows = [
    invoice({ number: 'a', dueDate: '2026-09-01' }),                                      // 29 days late, +100
    invoice({ number: 'av', kind: 'credit_note', dueDate: '2026-09-01', total: 40, subtotal: 40 }), // −40 in the same bucket
    invoice({ number: 'usd', currency: 'USD', dueDate: '2026-09-01', total: 55, subtotal: 55 }),
  ]
  const aged = agedReceivables(rows, 'MAD', TODAY)
  const mad = aged.find(row => row.currency === 'MAD')!
  const usd = aged.find(row => row.currency === 'USD')!
  assert.equal(mad.d1to30, 60)
  assert.equal(mad.total, 60)
  assert.equal(usd.d1to30, 55)
})

test('a manual overdue with an unreadable due date counts as 1–30 days late', () => {
  const [aged] = agedReceivables([invoice({ number: 'x', status: 'overdue', dueDate: 'nonsense' })], 'MAD', TODAY)
  assert.equal(aged.d1to30, 100)
})

test('an empty dataset ages nothing', () => {
  assert.deepEqual(agedReceivables([], 'MAD', TODAY), [])
})
