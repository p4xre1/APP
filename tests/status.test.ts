import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectiveStatus, isOutstanding, customerOutstanding } from '../src/lib/status'
import { collectCalendarItems } from '../src/lib/calendar'
import { fixture } from './fixtures'
import type { Invoice } from '../src/store/types'

const invoice = (status: Invoice['status'], dueDate: string) => ({ status, dueDate })

test('a sent invoice rolls into overdue the day after its due date, never before', () => {
  const today = '2026-09-30'
  assert.equal(effectiveStatus(invoice('sent', '2026-09-29'), today), 'overdue', 'yesterday')
  assert.equal(effectiveStatus(invoice('sent', '2026-09-30'), today), 'sent', 'due today is not overdue yet')
  assert.equal(effectiveStatus(invoice('sent', '2026-10-01'), today), 'sent', 'tomorrow')
})

test('paid and draft invoices never become overdue by date; a manual overdue stays', () => {
  const today = '2026-09-30'
  assert.equal(effectiveStatus(invoice('paid', '2020-01-01'), today), 'paid')
  assert.equal(effectiveStatus(invoice('draft', '2020-01-01'), today), 'draft')
  assert.equal(effectiveStatus(invoice('overdue', '2999-01-01'), today), 'overdue')
})

test('month ends, year ends and leap days compare as calendar days', () => {
  assert.equal(effectiveStatus(invoice('sent', '2026-02-28'), '2026-03-01'), 'overdue')
  assert.equal(effectiveStatus(invoice('sent', '2026-03-01'), '2026-02-28'), 'sent')
  assert.equal(effectiveStatus(invoice('sent', '2025-12-31'), '2026-01-01'), 'overdue')
  assert.equal(effectiveStatus(invoice('sent', '2024-02-29'), '2024-03-01'), 'overdue')
  assert.equal(effectiveStatus(invoice('sent', '2024-02-29'), '2024-02-29'), 'sent')
})

test('a damaged due date falls back to the stored status instead of guessing', () => {
  assert.equal(effectiveStatus(invoice('sent', 'not-a-date'), '2026-09-30'), 'sent')
  assert.equal(effectiveStatus(invoice('sent', ''), '2026-09-30'), 'sent')
  assert.equal(effectiveStatus(invoice('sent', '2026-09-01'), 'nonsense'), 'sent')
})

test('outstanding means effectively sent or overdue, nothing else', () => {
  const today = '2026-09-30'
  assert.equal(isOutstanding(invoice('sent', '2026-10-15'), today), true)
  assert.equal(isOutstanding(invoice('sent', '2026-09-01'), today), true)
  assert.equal(isOutstanding(invoice('overdue', '2026-10-15'), today), true)
  assert.equal(isOutstanding(invoice('paid', '2026-09-01'), today), false)
  assert.equal(isOutstanding(invoice('draft', '2026-09-01'), today), false)
})

test('the calendar uses the same rule: drafts show as due, sent-past-due as overdue', () => {
  const base = fixture().invoices[0]
  const sources = {
    notes: [], subscriptions: [], estimates: [],
    invoices: [
      { ...base, id: 'a', number: 'INV-A', status: 'sent' as const, dueDate: '2026-09-01' },
      { ...base, id: 'b', number: 'INV-B', status: 'draft' as const, dueDate: '2026-09-01' },
      { ...base, id: 'c', number: 'INV-C', status: 'overdue' as const, dueDate: '2026-12-01' },
    ],
  }
  const items = collectCalendarItems(sources, { today: '2026-09-30' })
  const byId = new Map(items.map(item => [item.id, item]))
  assert.equal(byId.get('a')!.label, 'Overdue invoice')
  assert.equal(byId.get('b')!.label, 'Invoice due', 'a draft is not owed yet')
  assert.equal(byId.get('c')!.label, 'Overdue invoice', 'manual overdue stays overdue')
})

test('customer outstanding: computed per currency from open invoices, never stored', () => {
  const today = '2026-09-30'
  const row = (patch: Record<string, unknown>) => ({
    customerId: 'c1', status: 'sent', dueDate: '2026-10-15', total: 100, currency: 'MAD', ...patch,
  } as Parameters<typeof customerOutstanding>[0][number])
  const invoices = [
    row({}),                                                        // sent, future due: owed
    row({ dueDate: '2026-09-01', total: 50 }),                      // sent past due: owed (effective overdue)
    row({ status: 'overdue', total: 25 }),                          // manual overdue: owed
    row({ status: 'paid', total: 999 }),                            // paid: not owed
    row({ status: 'draft', total: 999 }),                           // draft: not owed
    row({ currency: 'USD', total: 40 }),                            // second currency: its own row
    row({ currency: undefined, total: 5 }),                         // no currency: default currency
    row({ customerId: 'c2', total: 999 }),                          // someone else's invoice
  ]
  assert.deepEqual(customerOutstanding(invoices, 'c1', 'MAD', today), [
    { currency: 'MAD', amount: 180 },
    { currency: 'USD', amount: 40 },
  ])
  assert.deepEqual(customerOutstanding(invoices, 'c3', 'MAD', today), [])
})
