import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isIntentModule, moduleForGroup, setIntent, takeIntent } from '../src/lib/navigation-intent'

test('a calendar row hands its record to the module that owns it', () => {
  assert.equal(moduleForGroup('notes'), 'notebook')
  assert.equal(moduleForGroup('invoices'), 'invoices')
  assert.equal(moduleForGroup('estimates'), 'estimates')
  assert.equal(moduleForGroup('subscriptions'), 'subscriptions')
  // Anything unexpected still lands somewhere sensible instead of throwing.
  assert.equal(moduleForGroup('something-else'), 'subscriptions')
  assert.equal(isIntentModule('notebook'), true)
  assert.equal(isIntentModule('settings'), false)
})

test('an intent is read exactly once, and only by its own module', () => {
  assert.equal(takeIntent('notebook'), null)
  setIntent('invoices', 'invoice-7')
  // Another module looking first must not consume it.
  assert.equal(takeIntent('notebook'), null)
  assert.equal(takeIntent('invoices'), 'invoice-7')
  // Second read: gone, so returning to the module later does not reopen the record.
  assert.equal(takeIntent('invoices'), null)
  // One tap at a time: a second tap replaces the pending intent instead of queueing
  // a record the user has already navigated away from.
  setIntent('notebook', 'note-1')
  setIntent('estimates', 'estimate-2')
  assert.equal(takeIntent('estimates'), 'estimate-2')
  assert.equal(takeIntent('notebook'), null)
})

test('the modules that can be opened from the calendar do read their intent', () => {
  for (const [file, channel] of [
    ['src/modules/Notebook.tsx', 'notebook'],
    ['src/modules/Invoices.tsx', 'invoices'],
    ['src/modules/Estimates.tsx', 'estimates'],
    ['src/modules/Subscriptions.tsx', 'subscriptions'],
  ] as const) {
    const source = readFileSync(file, 'utf8')
    assert.ok(source.includes(`takeIntent('${channel}')`), `${file} does not read its intent`)
    assert.ok(/\.find\(row => row\.id === id\)/.test(source), `${file} does not look the record up`)
  }
})

test('the calendar and the dashboard card are wired to the same aggregation', () => {
  const calendar = readFileSync('src/modules/Calendar.tsx', 'utf8')
  const dashboard = readFileSync('src/modules/Dashboard.tsx', 'utf8')
  assert.ok(calendar.includes('collectCalendarItems'))
  assert.ok(dashboard.includes('upcomingItems'))
  // The dashboard card names the window it shows, and opens the calendar.
  assert.ok(dashboard.includes("t('Today and next 7 days')"))
  assert.ok(dashboard.includes("onNavigate('calendar')"))
  // Both use the shared row, so an icon or a label cannot drift apart.
  assert.ok(calendar.includes("from '../components/EventRow'"))
  assert.ok(dashboard.includes("from '../components/EventRow'"))
})
