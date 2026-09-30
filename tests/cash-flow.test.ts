// Cash flow: money that actually moved, on the day it moved. Revenue earned
// and cash received are different questions; this file tests the cash one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cashFlow, periodRange, localDateOf } from '../src/lib/cash-flow'
import type { Invoice, Expense, InvoicePayment } from '../src/store/types'

const pay = (amount: number, date: string): InvoicePayment => ({ id: `p-${amount}-${date}`, amount, date })
const invoice = (patch: Partial<Invoice>): Invoice => ({
  id: patch.number || 'inv', number: 'INV-1', customerId: 'c1', items: [], notes: '',
  subtotal: 1000, tax: 0, total: 1000, status: 'sent', currency: 'MAD',
  issueDate: '2026-01-01', dueDate: '2026-12-31', occurredAt: 0, createdAt: 0, updatedAt: 0, ...patch,
} as Invoice)
const expense = (amount: number, date: string, patch: Partial<Expense> = {}): Expense => ({
  id: `e-${amount}-${date}`, description: 'x', category: 'other', vendor: '', amount, date,
  currency: 'MAD', occurredAt: Date.parse(`${date}T12:00:00Z`), createdAt: 0, updatedAt: 0, ...patch,
} as Expense)

test('periods are plain date ranges anchored on today', () => {
  const today = '2026-09-30'
  assert.deepEqual(periodRange('month', today), { from: '2026-09-01', to: today })
  assert.deepEqual(periodRange('quarter', today), { from: '2026-07-01', to: today })
  assert.deepEqual(periodRange('year', today), { from: '2026-01-01', to: today })
  assert.deepEqual(periodRange('quarter', '2026-12-31'), { from: '2026-10-01', to: '2026-12-31' })
  const all = periodRange('all', today)
  assert.ok(all.from < '2026' && all.to > '2027')
})

test('payments count on their date; the settled remainder on the paid date', () => {
  const rows = [
    // Two partial payments in September, remainder settled in October.
    invoice({ number: 'a', status: 'paid', paidAt: Date.parse('2026-10-05T12:00:00'),
      payments: [pay(300, '2026-09-05'), pay(400, '2026-09-20')] }),
    // Sent with a partial payment: only the payment is cash.
    invoice({ number: 'b', payments: [pay(150, '2026-09-10')] }),
    // Sent, no payments: no cash at all.
    invoice({ number: 'c' }),
  ]
  const september = cashFlow(rows, [], '2026-09-01', '2026-09-30', 'MAD')
  assert.deepEqual(september, [{ currency: 'MAD', moneyIn: 850, moneyOut: 0, net: 850 }])
  const october = cashFlow(rows, [], '2026-10-01', '2026-10-31', 'MAD')
  assert.deepEqual(october, [{ currency: 'MAD', moneyIn: 300, moneyOut: 0, net: 300 }])
})

test('expenses and refunded credit notes are money out; open credit notes are not cash', () => {
  const rows = [
    invoice({ number: 'a', status: 'paid', paidAt: Date.parse('2026-09-10T12:00:00') }), // +1000
    invoice({ number: 'av1', kind: 'credit_note', status: 'paid', total: 200, subtotal: 200, paidAt: Date.parse('2026-09-15T12:00:00') }), // refund −200
    invoice({ number: 'av2', kind: 'credit_note', status: 'sent', total: 999, subtotal: 999 }), // open: no cash
  ]
  const flows = cashFlow(rows, [expense(120, '2026-09-20')], '2026-09-01', '2026-09-30', 'MAD')
  assert.deepEqual(flows, [{ currency: 'MAD', moneyIn: 1000, moneyOut: 320, net: 680 }])
})

test('currencies never mix and quiet currencies are omitted', () => {
  const rows = [
    invoice({ number: 'a', status: 'paid', paidAt: Date.parse('2026-09-10T12:00:00') }),
    invoice({ number: 'b', currency: 'USD', payments: [pay(50, '2026-09-12')] }),
    invoice({ number: 'c', currency: 'EUR' }), // nothing moved
  ]
  const flows = cashFlow(rows, [], '2026-09-01', '2026-09-30', 'MAD')
  assert.deepEqual(flows.map(row => row.currency).sort(), ['MAD', 'USD'])
  assert.equal(flows.find(row => row.currency === 'USD')!.moneyIn, 50)
})

test('an empty dataset flows nothing', () => {
  assert.deepEqual(cashFlow([], [], '2026-01-01', '2026-12-31', 'MAD'), [])
})

test('localDateOf uses the local calendar day', () => {
  const stamp = Date.parse('2026-09-10T12:00:00') // local noon: same day everywhere
  assert.equal(localDateOf(stamp), '2026-09-10')
})
