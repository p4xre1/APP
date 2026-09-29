import { test } from 'node:test'
import assert from 'node:assert/strict'
import { invoicesInPeriod, periodIsValid, periodRange, revenueCardData } from '../src/lib/revenue-period'
import { fixture } from './fixtures'
import type { Invoice } from '../src/store/types'

const source = fixture()
const invoice = (patch: Partial<Invoice>): Invoice => ({ ...source.invoices[0], projectId: undefined, items: [], ...patch })

test('share periods cover this month, last month, this year and custom ranges', () => {
  assert.deepEqual(periodRange('this-month', { today: '2026-09-29' }), { kind: 'this-month', from: '2026-09-01', to: '2026-09-30' })
  assert.deepEqual(periodRange('last-month', { today: '2026-01-15' }), { kind: 'last-month', from: '2025-12-01', to: '2025-12-31' })
  assert.deepEqual(periodRange('this-year', { today: '2026-01-15' }), { kind: 'this-year', from: '2026-01-01', to: '2026-12-31' })
  assert.deepEqual(periodRange('custom', { from: '2026-03-01', to: '2026-03-31' }), { kind: 'custom', from: '2026-03-01', to: '2026-03-31' })
  assert.equal(periodIsValid(periodRange('custom', { from: '2026-04-01', to: '2026-03-01' })), false)
  assert.equal(periodIsValid(periodRange('this-month', { today: '2026-09-29' })), true)
  assert.equal(periodIsValid(periodRange('custom', { from: 'nope', to: '2026-03-01' })), false)
})

test('the revenue card counts only paid invoices of one currency in the period', () => {
  const rows = [
    invoice({ id: 'a', status: 'paid', total: 100, occurredAt: Date.UTC(2026, 8, 5), currency: 'EUR' }),
    invoice({ id: 'b', status: 'paid', total: 50, occurredAt: Date.UTC(2026, 7, 20), currency: 'EUR' }),
    invoice({ id: 'c', status: 'sent', total: 30, occurredAt: Date.UTC(2026, 8, 6), currency: 'EUR' }),
    invoice({ id: 'd', status: 'paid', total: 99, occurredAt: Date.UTC(2026, 8, 7), currency: 'USD' }),
    invoice({ id: 'e', status: 'draft', total: 500, occurredAt: Date.UTC(2026, 8, 7), currency: 'EUR' }),
  ]
  const range = periodRange('this-month', { today: '2026-09-29' })
  assert.equal(invoicesInPeriod(rows, range, 'UTC').length, 4)
  const card = revenueCardData(rows, range, { currency: 'EUR', defaultCurrency: 'EUR', businessName: 'Café', language: 'en', timeZone: 'UTC' })
  assert.equal(card.total, 100)
  assert.equal(card.invoiceCount, 1)
  assert.equal(card.pending, 30)
  assert.equal(card.rtl, false)
  assert.match(card.periodLabel, /Sep/)
  const arabic = revenueCardData(rows, range, { currency: 'EUR', defaultCurrency: 'EUR', businessName: 'Café', language: 'ar', digits: 'arab', timeZone: 'UTC' })
  assert.equal(arabic.rtl, true)
})
