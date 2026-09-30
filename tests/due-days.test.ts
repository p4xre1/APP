// Settings.defaultDueDays: the payment term new invoices get (estimates expire
// after the same delay), plus the advisory Moroccan payment-terms levels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampDueDays, DEFAULT_DUE_DAYS, paymentTermsGap, paymentTermsLevel } from '../src/lib/status'
import { validateBackup, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { fixture } from './fixtures'
import type { FatoratiBackup } from '../src/lib/db'

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
