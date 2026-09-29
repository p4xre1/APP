import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addMonths, calendarEvents, dateKey, dayTotals, eventsByDate, monthGrid, monthLabel, timestampDateKey } from '../src/lib/calendar'
import { fixture } from './fixtures'
import type { Invoice } from '../src/store/types'

const source = fixture()
const customer = source.customers[0]
const invoice = (patch: Partial<Invoice>): Invoice => ({ ...source.invoices[0], projectId: undefined, items: [], ...patch })

test('month grid honours the first day of week and month length', () => {
  const monday = monthGrid('2026-09', 1)
  assert.equal(monday.length % 7, 0)
  assert.equal(monday.filter(Boolean).length, 30)
  assert.deepEqual(monday.slice(0, 2), [null, '2026-09-01'], '1 September 2026 is a Tuesday, Monday-first')
  const sunday = monthGrid('2026-09', 0)
  assert.deepEqual(sunday.slice(0, 3), [null, null, '2026-09-01'], 'Sunday-first leaves two blanks')
  assert.equal(sunday.filter(Boolean).length, 30)
  assert.equal(monthGrid('2026-02', 1).filter(Boolean).length, 28)
  assert.equal(addMonths('2026-01', -1), '2025-12')
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(dateKey(new Date('2026-09-29T00:30:00Z')), '2026-09-29')
  assert.equal(timestampDateKey(Date.UTC(2026, 8, 29, 0, 30), 'America/New_York'), '2026-09-28')
  assert.match(monthLabel('2026-09', 'en'), /September 2026/)
})

test('invoice due dates, estimate expiry dates and payment dates land on the right days', () => {
  const events = calendarEvents({
    invoices: [
      invoice({ id: 'a', number: 'INV-1', status: 'sent', dueDate: '2026-09-10', occurredAt: Date.UTC(2026, 8, 1) }),
      invoice({ id: 'b', number: 'INV-2', status: 'paid', dueDate: '2026-09-20', paidAt: Date.UTC(2026, 8, 12, 10), occurredAt: Date.UTC(2026, 8, 1) }),
    ],
    estimates: [{ ...source.estimates[0], id: 'e', number: 'EST-1', status: 'sent', expiryDate: '2026-09-30' }],
    customers: [customer], defaultCurrency: 'EUR', today: '2026-09-29', timeZone: 'UTC',
  })
  assert.deepEqual(events.map(event => [event.kind, event.date]), [
    ['invoice-due', '2026-09-10'], ['payment', '2026-09-12'], ['invoice-due', '2026-09-20'], ['estimate-expiry', '2026-09-30'],
  ])
  const grouped = eventsByDate(events)
  assert.equal(grouped.get('2026-09-10')!.length, 1)
  assert.equal(grouped.get('2026-09-12')![0].kind, 'payment')
  assert.equal(grouped.get('2026-09-12')![0].party, customer.name)
})

test('past-due open items are red, paid and draft items are not', () => {
  const events = calendarEvents({
    invoices: [
      invoice({ id: 'late', number: 'INV-L', status: 'sent', dueDate: '2026-09-01' }),
      invoice({ id: 'explicit', number: 'INV-E', status: 'overdue', dueDate: '2026-10-30' }),
      invoice({ id: 'draft', number: 'INV-D', status: 'draft', dueDate: '2026-09-01' }),
      invoice({ id: 'paid', number: 'INV-P', status: 'paid', dueDate: '2026-09-01', paidAt: Date.UTC(2026, 7, 20) }),
      invoice({ id: 'expired', number: 'EST-9', status: 'sent', dueDate: '2026-10-01' }),
    ],
    estimates: [
      { ...source.estimates[0], id: 'expired', number: 'EST-9', status: 'sent', expiryDate: '2026-09-05' },
      { ...source.estimates[0], id: 'closed', number: 'EST-8', status: 'accepted', expiryDate: '2026-09-05' },
    ],
    defaultCurrency: 'EUR', today: '2026-09-29', timeZone: 'UTC',
  })
  const overdue = events.filter(event => event.overdue).map(event => event.id).sort()
  assert.deepEqual(overdue, ['estimate-expiry:expired', 'invoice-due:explicit', 'invoice-due:late'])
  const paidEvent = events.find(event => event.kind === 'payment')!
  assert.equal(paidEvent.date, '2026-08-20', 'paidAt is the payment date when present')
  assert.equal(paidEvent.overdue, false)
})

test('day totals never mix currencies', () => {
  const events = calendarEvents({
    invoices: [
      invoice({ id: 'eur', number: 'A', status: 'sent', currency: 'EUR', total: 10, dueDate: '2026-09-10' }),
      invoice({ id: 'eur2', number: 'B', status: 'sent', currency: 'EUR', total: 5, dueDate: '2026-09-10' }),
      invoice({ id: 'usd', number: 'C', status: 'sent', currency: 'USD', total: 3, dueDate: '2026-09-10' }),
    ],
    estimates: [], defaultCurrency: 'EUR', today: '2026-09-01', timeZone: 'UTC',
  })
  const totals = dayTotals(eventsByDate(events).get('2026-09-10')!).sort((a, b) => a.currency.localeCompare(b.currency))
  assert.deepEqual(totals, [{ currency: 'EUR', total: 15, count: 2 }, { currency: 'USD', total: 3, count: 1 }])
})
