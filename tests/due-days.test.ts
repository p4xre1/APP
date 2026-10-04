// Settings.defaultDueDays: the payment term new invoices get (estimates expire
// after the same delay), plus the advisory Moroccan payment-terms levels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampDueDays, DEFAULT_DUE_DAYS, dueDateFromTerms, paymentTermsGap, paymentTermsLevel } from '../src/lib/status'
import { isISODate, todayISO } from '../src/lib/subscriptions'
import { validateBackup, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixture } from './fixtures'
import type { FatoratiBackup } from '../src/lib/db'

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => (entry.isDirectory() ? sources(join(directory, entry.name)) : [join(directory, entry.name)]))
}

test('clampDueDays: whole days 0–365, anything else falls back to the old 30', () => {
  assert.equal(DEFAULT_DUE_DAYS, 30)
  assert.equal(clampDueDays(0), 0)
  assert.equal(clampDueDays(60), 60)
  assert.equal(clampDueDays(365), 365)
  for (const bad of [undefined, null, -1, 366, 1.5, NaN, Infinity, '30', true]) {
    assert.equal(clampDueDays(bad), 30, String(bad))
  }
})

test('the issue→due gap is counted in local calendar days', () => {
  assert.equal(paymentTermsGap('2026-09-30', '2026-10-30'), 30)
  assert.equal(paymentTermsGap('2026-09-30', '2026-09-30'), 0)
  assert.equal(paymentTermsGap('2026-12-31', '2027-01-30'), 30) // across a year end
  assert.equal(paymentTermsGap('2026-10-30', '2026-09-30'), -30)
  assert.equal(paymentTermsGap('nonsense', '2026-09-30'), null)
  assert.equal(paymentTermsGap('2026-09-30', ''), null)
})

test('MA hint levels: quiet to 60, a hint above 60, a stronger one above 120, never blocking', () => {
  assert.equal(paymentTermsLevel(30), 'ok')
  assert.equal(paymentTermsLevel(60), 'ok', 'exactly 60 days is fine')
  assert.equal(paymentTermsLevel(61), 'long')
  assert.equal(paymentTermsLevel(120), 'long', 'exactly 120 days can be agreed by contract')
  assert.equal(paymentTermsLevel(121), 'excessive')
  assert.equal(paymentTermsLevel(null), 'ok', 'a malformed date warns about nothing')
})

test('defaultDueDays is validated in backups and survives a round-trip', async () => {
  const source = fixture() as unknown as FatoratiBackup & { settings: Record<string, unknown>[] }
  source.settings[0].defaultDueDays = 45
  validateBackup(source)
  assert.deepEqual(await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é'), source)
  // A legacy file simply has no value: still valid, and the app reads it as 30.
  delete source.settings[0].defaultDueDays
  validateBackup(source)
  for (const bad of [-1, 366, 1.5, '30', true]) {
    source.settings[0].defaultDueDays = bad as unknown as number
    assert.throws(() => validateBackup(source), /Invalid backup record/, String(bad))
  }
})

test('a due date is issue date + days on the calendar, and the fallback is the LOCAL day', () => {
  assert.equal(dueDateFromTerms('2026-10-03', 0), '2026-10-03')
  assert.equal(dueDateFromTerms('2026-10-03', 30), '2026-11-02')
  assert.equal(dueDateFromTerms('2026-12-31', 30), '2027-01-30') // across a year end
  assert.equal(dueDateFromTerms('2028-02-27', 1), '2028-02-28')
  assert.equal(dueDateFromTerms('2026-10-03', 400), '2026-11-02', 'a malformed term falls back to 30')
  // A malformed issue date falls back to today in the device's local calendar, never
  // to the UTC day (the two differ either side of midnight).
  const before = todayISO()
  const fallback = dueDateFromTerms('nonsense', 0)
  const after = todayISO()
  assert.ok(fallback === before || fallback === after, `${fallback} is not the local day`)
  assert.ok(isISODate(fallback))
})

test('no source derives "today" from the UTC clock: the local day comes from todayISO()', () => {
  // `new Date().toISOString().slice(0, 10)` is the UTC day. It dated new invoices,
  // estimates and subscriptions tomorrow (west of UTC) or yesterday (east of UTC)
  // while the lists, overdue badges and reminders all read the local day, and it can
  // even disagree with the local year inside a `PREFIX-YYYY` document number.
  const offenders: string[] = []
  for (const file of sources('src').filter(name => /\.tsx?$/.test(name))) {
    // notifications.addDays() adds days to an ISO date string (UTC-anchored on
    // purpose) and never reads the current instant, so it is the one exception.
    if (file.endsWith('src/lib/notifications.ts')) continue
    for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
      if (!/toISOString\(\)\s*\.\s*slice\(0,\s*10\)/.test(line)) continue
      if (/\bDate\.now\(\)|new Date\(\)/.test(line)) offenders.push(`${file}:${index + 1}`)
    }
  }
  assert.deepEqual(offenders, [], 'use todayISO() for the local calendar day')
})
