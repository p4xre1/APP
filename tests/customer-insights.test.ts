import { test } from 'node:test'
import assert from 'node:assert/strict'
import { customerInsights } from '../src/lib/customer-insights'
import type { Invoice } from '../src/store/types'

const TODAY = '2026-10-04'
function invoice(id: string, customerId: string, patch: Partial<Invoice> = {}): Invoice {
  return {
    id, number: id, customerId, items: [], subtotal: 100, tax: 0, total: 100,
    status: 'sent', issueDate: '2026-09-01', dueDate: '2026-12-31', notes: '',
    currency: 'USD', createdAt: 1, updatedAt: 1,
    ...patch,
  } as Invoice
}

test('customer ledger separates invoiced, received and open balances, including partial and legacy payments', () => {
  const invoices = [
    invoice('paid-legacy', 'a', { status: 'paid', total: 100 }),
    invoice('partial', 'a', { total: 100, payments: [{ id: 'p1', amount: 30, date: '2026-09-10' }] }),
    invoice('unpaid', 'a', { total: 60 }),
    invoice('draft', 'a', { status: 'draft', total: 500, payments: [{ id: 'draft-pay', amount: 40, date: '2026-09-10' }] }),
    invoice('credit', 'a', { status: 'paid', kind: 'credit_note', total: 10 }),
    invoice('top-client', 'b', { status: 'paid', total: 200 }),
  ]
  const insights = customerInsights([{ id: 'a' }, { id: 'b' }, { id: 'c' }], invoices, 'USD', TODAY)
  const a = insights.get('a')!
  assert.deepEqual(a.invoiced, [{ currency: 'USD', amount: 250 }], 'drafts are excluded and issued credit notes subtract')
  assert.deepEqual(a.received, [{ currency: 'USD', amount: 120 }], 'partial receipts and paid credit notes are netted')
  assert.deepEqual(a.outstanding, [{ currency: 'USD', amount: 130 }], 'partial payment reduces the balance owed')
  assert.equal(a.rankValue, 120)
  assert.equal(a.rank, 2)
  assert.equal(insights.get('b')?.rank, 1)
  assert.equal(insights.get('c')?.rank, null, 'a customer without collected money has no rank')
})

test('ranking compares currencies only when a saved rate converts them to the default currency', () => {
  const invoices = [
    invoice('eur', 'eur-client', { status: 'paid', currency: 'EUR', total: 100, exchangeRate: 1.1, rateCurrency: 'USD' }),
    invoice('usd', 'usd-client', { status: 'paid', currency: 'USD', total: 105 }),
    invoice('mad-paid', 'mad-client', { status: 'paid', currency: 'MAD', total: 900 }),
    invoice('mad-open', 'mad-client', { status: 'sent', currency: 'MAD', total: 50 }),
  ]
  const insights = customerInsights([{ id: 'eur-client' }, { id: 'usd-client' }, { id: 'mad-client' }], invoices, 'USD', TODAY)
  assert.equal(insights.get('eur-client')?.rankValue, 110)
  assert.equal(insights.get('eur-client')?.rank, 1)
  assert.equal(insights.get('usd-client')?.rank, 2)
  assert.equal(insights.get('mad-client')?.rankValue, null)
  assert.equal(insights.get('mad-client')?.rank, null)
  assert.equal(insights.get('mad-client')?.outstandingValue, null)
  assert.deepEqual(insights.get('mad-client')?.received, [{ currency: 'MAD', amount: 900 }], 'native-currency totals remain visible')
  assert.deepEqual(insights.get('mad-client')?.outstanding, [{ currency: 'MAD', amount: 50 }])
})

test('equal collected totals share a competition rank', () => {
  const invoices = [invoice('one', 'a', { status: 'paid', total: 25 }), invoice('two', 'b', { status: 'paid', total: 25 }), invoice('three', 'c', { status: 'paid', total: 10 })]
  const insights = customerInsights([{ id: 'a' }, { id: 'b' }, { id: 'c' }], invoices, 'USD', TODAY)
  assert.equal(insights.get('a')?.rank, 1)
  assert.equal(insights.get('b')?.rank, 1)
  assert.equal(insights.get('c')?.rank, 3)
})
