// 1099-NEC preparation for a US contractor: what was paid to each vendor in a year.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contractorPayments, FORM_1099_THRESHOLD } from '../src/lib/contractor-payments'
import type { Expense } from '../src/store/types'

const expense = (patch: Partial<Expense>): Expense => ({
  id: patch.id || 'e1', description: 'Subcontractor', amount: 100, category: 'Subcontracting',
  date: '2026-03-01', vendor: 'Béton Nord', createdAt: 1, updatedAt: 2, currency: 'USD', ...patch,
} as Expense)

test('the federal threshold is 2,000 USD for the 2026 tax year', () => {
  assert.equal(FORM_1099_THRESHOLD, 2000)
})

test('expenses are grouped per vendor, case- and space-insensitively', () => {
  const rows = contractorPayments([
    expense({ id: 'a', vendor: 'Béton Nord', amount: 900 }),
    expense({ id: 'b', vendor: ' béton nord ', amount: 1100 }), // same vendor, same year
    expense({ id: 'c', vendor: 'Électricité Atlas', amount: 400 }),
  ], 2026, 'USD')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].vendor, 'Béton Nord', 'the first spelling is kept')
  assert.equal(rows[0].total, 2000)
  assert.equal(rows[0].count, 2)
  assert.equal(rows[0].formDue, true, 'exactly 2,000 USD reaches the threshold')
  assert.equal(rows[1].vendor, 'Électricité Atlas')
  assert.equal(rows[1].formDue, false)
})

test('only the chosen year and currency are counted, and rows sort by total', () => {
  const rows = contractorPayments([
    expense({ id: 'a', vendor: 'Alpha', amount: 500 }),
    expense({ id: 'b', vendor: 'Beta', amount: 300, date: '2025-12-31' }),        // other year
    expense({ id: 'c', vendor: 'Alpha', amount: 200, currency: 'MAD' }),          // other currency
    expense({ id: 'd', vendor: 'Alpha', amount: 250, currency: undefined }),      // default currency
    expense({ id: 'e', vendor: 'Alpha', amount: 700 }),
  ], 2026, 'USD')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].total, 1450, '500 + 250 + 700, nothing else')
  assert.equal(rows[0].count, 3)

  const sorted = contractorPayments([
    expense({ id: 'a', vendor: 'Small', amount: 50 }),
    expense({ id: 'b', vendor: 'Big', amount: 5000 }),
    expense({ id: 'c', vendor: 'Middle', amount: 900 }),
  ], 2026, 'USD')
  assert.deepEqual(sorted.map(row => row.vendor), ['Big', 'Middle', 'Small'])
  assert.deepEqual(sorted.map(row => row.formDue), [true, false, false])
})

test('an unusable expense cannot be attributed to anyone: it is skipped, never guessed', () => {
  const rows = contractorPayments([
    expense({ id: 'a', vendor: '   ', amount: 9000 }),
    expense({ id: 'b', vendor: 'Real', amount: 100 }),
    expense({ id: 'c', vendor: 'Bad date', amount: 9000, date: 'nonsense' }),
    expense({ id: 'd', vendor: 'Partial date', amount: 9000, date: '2026-3-1' }),
    expense({ id: 'e', vendor: 'Negative', amount: -500 }),
    expense({ id: 'f', vendor: 'Zero', amount: 0 }),
    expense({ id: 'g', vendor: 'Not a number', amount: Number.NaN }),
  ], 2026, 'USD')
  assert.deepEqual(rows, [{ vendor: 'Real', total: 100, count: 1, formDue: false }])
})

test('the Reports card is US-only and lists the vendors that reached the threshold', async () => {
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { ContractorPaymentsCard } = await import('../src/modules/Reports')
  const expenses = [
    expense({ id: 'a', vendor: 'Béton Nord', amount: 1500, date: '2026-02-10' }),
    expense({ id: 'b', vendor: 'Béton Nord', amount: 700, date: '2026-06-01' }),
    expense({ id: 'c', vendor: 'Électricité Atlas', amount: 120, date: '2026-06-02' }),
    expense({ id: 'd', vendor: 'Ancien fournisseur', amount: 9000, date: '2025-06-02' }),
  ]
  const us = renderToStaticMarkup(createElement(ContractorPaymentsCard, { region: 'US', expenses, currency: 'USD' }))
  assert.ok(us.includes('Contractor payments (1099-NEC check)'), 'the card renders for a US business')
  assert.ok(us.includes('Béton Nord'))
  assert.ok(us.includes('2,000 USD or more'), 'the badge flags the vendor at 2,200 USD')
  assert.ok(us.includes('2 records'))
  assert.equal(us.includes('Ancien fournisseur'), false, 'another year is not in this year\'s card')
  assert.ok(us.includes('W-9'), 'the practical W-9 note is shown')

  // Morocco has no 1099-NEC: the card must not exist there.
  const ma = renderToStaticMarkup(createElement(ContractorPaymentsCard, { region: 'MA', expenses, currency: 'USD' }))
  assert.equal(ma, '')

  const empty = renderToStaticMarkup(createElement(ContractorPaymentsCard, { region: 'US', expenses: [], currency: 'USD' }))
  assert.ok(empty.includes('No vendor expenses recorded this year.'))
})
