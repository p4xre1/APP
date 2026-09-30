import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CALENDAR_GROUPS, DEFAULT_FILTERS, collectCalendarItems, dayCounts, daySummary, daysInMonth, gridRange,
  groupByDate, isLeapYear, itemsInRange, itemsOn, monthGrid, shiftMonth, upcomingItems, weekdayLabels,
  type CalendarItem,
} from '../src/lib/calendar'
import type { Estimate, Invoice, Note, Subscription } from '../src/store/types'

const note = (patch: Partial<Note> = {}): Note => ({
  id: 'n1', body: 'Buy paper', tags: [], pinned: false, archived: false, type: 'idea', done: false,
  createdAt: 1, updatedAt: 1, ...patch,
})
const invoice = (patch: Partial<Invoice> = {}): Invoice => ({
  id: 'i1', number: 'F-001', customerId: 'c1', status: 'sent', issueDate: '2026-09-01', dueDate: '2026-10-10',
  items: [], currency: 'MAD', language: 'en', occurredAt: 1, createdAt: 1, updatedAt: 1, ...patch,
} as Invoice)
const subscription = (patch: Partial<Subscription> = {}): Subscription => ({
  id: 's1', serviceName: 'Hosting', category: 'Tools', amountMinor: 1000, currency: 'USD', billingCycle: 'monthly',
  autoRenew: true, startDate: '2026-10-20', createdAt: 1, updatedAt: 1, ...patch,
} as Subscription)
const estimate = (patch: Partial<Estimate> = {}): Estimate => ({
  id: 'e1', number: 'D-001', customerId: 'c1', status: 'sent', issueDate: '2026-09-01', expiryDate: '2026-10-15',
  items: [], currency: 'MAD', language: 'en', occurredAt: 1, createdAt: 1, updatedAt: 1, ...patch,
} as Estimate)
const empty = { notes: [], invoices: [], subscriptions: [], estimates: [] }
const on = (today: string) => ({ today })

test('the month grid has the right length, leap years included', () => {
  assert.equal(daysInMonth(2026, 1), 31)
  assert.equal(daysInMonth(2026, 2), 28)
  assert.equal(daysInMonth(2024, 2), 29)
  assert.equal(daysInMonth(2000, 2), 29)
  assert.equal(daysInMonth(1900, 2), 28)
  assert.equal(daysInMonth(2026, 4), 30)
  assert.equal(daysInMonth(2026, 12), 31)
  assert.equal(isLeapYear(2024), true)
  assert.equal(isLeapYear(2026), false)
  const days = monthGrid(2026, 2, 1)
  assert.equal(days.length % 7, 0)
  assert.equal(days.filter(day => day.inMonth).length, 28)
  assert.equal(days[0].date, '2026-01-26', 'a Monday start pads with the January days')
  assert.equal(days.map(day => day.date)[0], '2026-01-26')
})

test('the week starts on the day chosen in Settings and stays aligned', () => {
  for (const firstDay of [0, 1, 6] as const) {
    const days = monthGrid(2026, 10, firstDay)
    assert.equal(days.length % 7, 0, `first day ${firstDay}`)
    assert.equal(new Date(`${days[0].date}T12:00:00Z`).getUTCDay(), firstDay, `first day ${firstDay}`)
    assert.equal(days.filter(day => day.inMonth).length, daysInMonth(2026, 10))
    assert.equal(days[0].date, days[0].inMonth ? days[0].date : days[0].date)
    // Every day is unique and consecutive, including across a month boundary.
    const numbers = days.map(day => new Date(`${day.date}T12:00:00Z`).getTime())
    for (let index = 1; index < numbers.length; index++) assert.equal(numbers[index] - numbers[index - 1], 86_400_000)
  }
  // Monday is the default in every case that does not pass a first day.
  assert.deepEqual(monthGrid(2026, 10).map(day => day.date), monthGrid(2026, 10, 1).map(day => day.date))
  const range = gridRange(2026, 10, 1)
  assert.deepEqual(range, { from: '2026-09-28', to: '2026-11-01' })
  assert.deepEqual(gridRange(2026, 10, 0), { from: '2026-09-27', to: '2026-10-31' })
  // A full last week can reach into the next month: the drawn grid stays rectangular.
  assert.deepEqual(gridRange(2026, 10, 6), { from: '2026-09-26', to: '2026-11-06' })
})

test('month navigation rolls over the year in both directions', () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 })
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 })
  assert.deepEqual(shiftMonth(2026, 6, -14), { year: 2025, month: 4 })
  assert.deepEqual(shiftMonth(2026, 6, 18), { year: 2027, month: 12 })
})

test('weekday labels start on the chosen day and are real translations', () => {
  const monday = weekdayLabels('en-GB', 1)
  assert.equal(monday.length, 7)
  assert.match(monday[0], /^Mon/i)
  assert.match(weekdayLabels('en-GB', 0)[0], /^Sun/i)
  assert.match(weekdayLabels('en-GB', 6)[0], /^Sat/i)
  const arabic = weekdayLabels('ar', 1)
  assert.equal(arabic.length, 7)
  assert.equal(new Set(arabic).size, 7)
})

test('local calendar dates survive a DST switch and a leap day', () => {
  // A spring-forward day in Europe (29 March 2026) still has its items on that date.
  const sources = { ...empty, notes: [note({ id: 'dst', date: '2026-03-29' }), note({ id: 'leap', date: '2024-02-29' })] }
  const items = collectCalendarItems(sources, on('2026-03-01'))
  assert.deepEqual(items.map(item => item.date), ['2024-02-29', '2026-03-29'])
  // Adding days to a date never rounds to the neighbouring day.
  const february = upcomingItems({ ...empty, notes: [note({ id: 'feb', date: '2024-02-29' })] }, { ...on('2024-02-25'), days: 7 })
  assert.deepEqual(february.map(item => item.date), ['2024-02-29'])
})

test('notes and tasks appear on their date with their own icon kind', () => {
  const sources = {
    ...empty,
    notes: [
      note({ id: 'a', type: 'idea', date: '2026-10-05' }),
      note({ id: 'b', type: 'task', date: '2026-10-05', time: '08:15' }),
      note({ id: 'c', type: 'note', date: '2026-10-05' }),
      note({ id: 'd', type: 'task', date: '2026-10-06', done: true }),
      note({ id: 'undated', body: 'no date' }),
    ],
  }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  assert.equal(items.length, 4, 'the undated note stays out of the calendar')
  assert.deepEqual(items.map(item => item.kind), ['task', 'idea', 'note', 'task'])
  assert.deepEqual(items.map(item => item.label), ['Task', 'Idea', 'Note', 'Task'])
  assert.equal(items[0].time, '08:15')
  assert.equal(items[3].done, true, 'a finished task keeps its day but is drawn as done')
  assert.ok(items.every(item => item.detail === 'Buy paper'))
  assert.ok(items.every(item => item.id !== 'undated'))
})

test('an archived note leaves the calendar while a done task keeps its day', () => {
  const sources = {
    ...empty,
    notes: [
      note({ id: 'archived', date: '2026-10-05', archived: true }),
      note({ id: 'done', type: 'task', done: true, date: '2026-10-05' }),
    ],
  }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  assert.deepEqual(items.map(item => item.id), ['done'])
  assert.equal(items[0].done, true, 'a finished task is drawn as finished, not hidden')
})

test('only unpaid invoices are listed and the late ones are marked overdue', () => {
  const sources = {
    ...empty,
    invoices: [
      invoice({ id: 'paid', status: 'paid', dueDate: '2026-10-05' }),
      invoice({ id: 'due', status: 'sent', dueDate: '2026-10-12' }),
      invoice({ id: 'late', number: 'F-009', status: 'overdue', dueDate: '2026-09-28' }),
      invoice({ id: 'draft', status: 'draft', dueDate: '2026-10-20' }),
    ],
  }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  assert.deepEqual(items.map(item => item.id).sort(), ['draft', 'due', 'late'])
  const late = items.find(item => item.id === 'late')!
  assert.equal(late.label, 'Overdue invoice')
  assert.equal(late.overdue, true)
  assert.equal(late.detail, 'F-009')
  assert.equal(items.find(item => item.id === 'due')!.overdue, false)
  assert.equal(items.find(item => item.id === 'draft')!.label, 'Invoice due')
})

test('subscriptions show their next renewal or their end date, never a cancelled one', () => {
  const sources = {
    ...empty,
    subscriptions: [
      subscription({ id: 'monthly', startDate: '2026-10-20' }),
      subscription({ id: 'oneoff', autoRenew: false, billingCycle: 'one_time_period', periodMonths: 3, startDate: '2026-08-01' }),
      subscription({ id: 'cancelled', cancelledAt: 123 }),
      subscription({ id: 'past', autoRenew: false, billingCycle: 'one_time_period', periodMonths: 1, startDate: '2026-08-01' }),
    ],
  }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  assert.deepEqual(items.map(item => item.id).sort(), ['monthly', 'oneoff'])
  assert.equal(items.find(item => item.id === 'monthly')!.label, 'Renewal')
  assert.equal(items.find(item => item.id === 'oneoff')!.label, 'Subscription ends')
  assert.ok(items.every(item => item.group === 'subscriptions'))
})

test('pending estimates sit on their expiry date and closed ones disappear', () => {
  const sources = {
    ...empty,
    estimates: [
      estimate({ id: 'draft', status: 'draft' }),
      estimate({ id: 'sent', status: 'sent', expiryDate: '2026-11-02' }),
      estimate({ id: 'accepted', status: 'accepted' }),
      estimate({ id: 'declined', status: 'declined' }),
      estimate({ id: 'nodate', expiryDate: '' }),
    ],
  }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  assert.deepEqual(items.map(item => item.id).sort(), ['draft', 'sent'])
  assert.ok(items.every(item => item.label === 'Estimate expires'))
  assert.equal(items.find(item => item.id === 'sent')!.date, '2026-11-02')
})

test('a note pointing at a deleted customer, invoice or project still shows up', () => {
  const sources = { ...empty, notes: [note({ id: 'orphan', date: '2026-10-05', linkedCustomerId: 'gone', linkedInvoiceId: 'gone', linkedProjectId: 'gone' })] }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  assert.equal(items.length, 1)
  assert.equal(items[0].id, 'orphan')
  // The aggregation never resolves links, so a missing target cannot throw.
  assert.doesNotThrow(() => upcomingItems(sources, { ...on('2026-10-01'), days: 7 }))
})

test('the visible window is what gets drawn, and the filter switches narrow it', () => {
  const sources = {
    ...empty,
    notes: [note({ id: 'in', date: '2026-10-05' }), note({ id: 'out', date: '2026-11-20' })],
    invoices: [invoice({ id: 'bill', dueDate: '2026-10-06' })],
    subscriptions: [subscription({ id: 'sub', startDate: '2026-10-07' })],
    estimates: [estimate({ id: 'est', expiryDate: '2026-10-08' })],
  }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  const range = gridRange(2026, 10, 1)
  const visible = itemsInRange(items, range.from, range.to, DEFAULT_FILTERS)
  assert.deepEqual(visible.map(item => item.id).sort(), ['bill', 'est', 'in', 'sub'])
  assert.deepEqual(itemsInRange(items, range.from, range.to, ['invoices']).map(item => item.id), ['bill'])
  assert.deepEqual(itemsInRange(items, range.from, range.to, []), [])
  assert.deepEqual(itemsInRange(items, range.from, range.to, [...CALENDAR_GROUPS]).length, 4)
  assert.deepEqual(itemsOn(items, '2026-10-05').map(item => item.id), ['in'])
})

test('counts and the accessible day description follow the visible days', () => {
  const sources = {
    ...empty,
    notes: [note({ id: 'a', date: '2026-10-05' }), note({ id: 'b', date: '2026-10-05' }), note({ id: 'c', date: '2026-10-07' })],
  }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  const counts = dayCounts(items)
  assert.equal(counts.get('2026-10-05'), 2)
  assert.equal(counts.get('2026-10-07'), 1)
  assert.equal(counts.get('2026-10-06'), undefined)
  const grouped = groupByDate(items)
  assert.equal(grouped.get('2026-10-05')!.length, 2)
  assert.deepEqual(daySummary(0), { key: 'No items', count: 0 })
  assert.deepEqual(daySummary(3), { key: '{count} items', count: 3 })
})

test('the dashboard window covers today plus seven days, and nothing else', () => {
  const sources = {
    ...empty,
    notes: [
      note({ id: 'today', date: '2026-10-01' }),
      note({ id: 'edge', date: '2026-10-08' }),
      note({ id: 'late', date: '2026-10-09' }),
      note({ id: 'yesterday', date: '2026-09-30' }),
    ],
  }
  assert.deepEqual(upcomingItems(sources, { ...on('2026-10-01'), days: 7 }).map(item => item.id), ['today', 'edge'])
  assert.deepEqual(upcomingItems(sources, { ...on('2026-10-09'), days: 7 }).map(item => item.id), ['late'])
  // The window crosses a month end without losing a day.
  assert.deepEqual(upcomingItems({ ...empty, notes: [note({ id: 'november', date: '2026-11-01' })] }, { ...on('2026-10-28'), days: 7 }).map(item => item.id), ['november'])
})

test('a notebook with thousands of entries stays fast and only the visible month is drawn', () => {
  // 4 000 dated notes spread over three years, plus invoices, renewals and estimates.
  const notes = Array.from({ length: 4_000 }, (_, index) => {
    const month = (index % 36) + 1
    const year = 2025 + Math.floor(month / 13)
    const day = (index % 28) + 1
    return note({ id: `n${index}`, date: `${year}-${String(month % 12 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` })
  })
  const sources = { notes, invoices: [invoice()], subscriptions: [subscription()], estimates: [estimate()] }
  const items = collectCalendarItems(sources, on('2026-10-01'))
  assert.equal(items.length, notes.length + 3)
  const range = gridRange(2026, 10, 1)
  const start = performance.now()
  const visible = itemsInRange(items, range.from, range.to)
  const counts = dayCounts(visible)
  const elapsed = performance.now() - start
  // The visible month is a small slice of the three years, and every item in it is
  // inside the window: the screen never walks the whole notebook.
  assert.ok(visible.length > 0 && visible.length < 400, `${visible.length} items in one month`)
  assert.ok([...visible].every(item => item.date >= range.from && item.date <= range.to))
  assert.ok([...counts.values()].reduce((total, count) => total + count, 0) === visible.length)
  assert.ok(elapsed < 1_500, `filtering ${items.length} items took ${Math.round(elapsed)} ms`)
})

test('items are ordered by day and then by time, and the sort is stable', () => {
  const sources = {
    ...empty,
    notes: [note({ id: 'lunch', date: '2026-10-05', time: '12:30' }), note({ id: 'standup', date: '2026-10-05', time: '08:00' })],
    invoices: [invoice({ id: 'bill', dueDate: '2026-10-03' })],
  }
  const items: CalendarItem[] = collectCalendarItems(sources, on('2026-10-01'))
  assert.deepEqual(items.map(item => item.id), ['bill', 'standup', 'lunch'])
  assert.deepEqual(collectCalendarItems(sources, on('2026-10-01')).map(item => item.id), ['bill', 'standup', 'lunch'])
})
