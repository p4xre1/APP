// Customer.kind: 'business' (default, also what every pre-2.2 record means) or
// 'individual'. Validated in backups, exported to CSV, survives a round-trip.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateBackup, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { csvRows } from '../src/lib/csv'
import { fixture } from './fixtures'
import type { FatoratiBackup } from '../src/lib/db'

const withKind = (kind: unknown) => {
  const backup = fixture() as unknown as FatoratiBackup & { customers: Record<string, unknown>[] }
  if (kind === undefined) delete backup.customers[0].kind
  else backup.customers[0].kind = kind as 'business' | 'individual'
  return backup
}

test('backup validation accepts business/individual/absent and rejects anything else', () => {
  validateBackup(withKind('business'))
  validateBackup(withKind('individual'))
  validateBackup(withKind(undefined)) // legacy record
  for (const bad of ['company', '', 1, true, {}]) {
    assert.throws(() => validateBackup(withKind(bad)), /Invalid backup record/, String(bad))
  }
})

test('customer kind and location survive an encrypted backup round-trip', async () => {
  const source = withKind('individual')
  Object.assign(source.customers[0], { country: 'US', state: 'CA', city: 'San Francisco' })
  assert.deepEqual(await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é'), source)
})

test('backup validation accepts optional Morocco/US location fields and rejects invalid country data', () => {
  const morocco = withKind('business')
  Object.assign(morocco.customers[0], { country: 'MA', city: 'Casablanca' })
  validateBackup(morocco)
  const unitedStates = withKind('individual')
  Object.assign(unitedStates.customers[0], { country: 'US', state: 'CA', city: 'Los Angeles' })
  validateBackup(unitedStates)
  const other = withKind('individual')
  Object.assign(other.customers[0], { country: 'other', countryName: 'Spain' })
  validateBackup(other)
  for (const invalidCountry of ['USA', '', 1]) {
    const invalid = withKind('business') as unknown as FatoratiBackup & { customers: Record<string, unknown>[] }
    Object.assign(invalid.customers[0], { country: invalidCountry })
    assert.throws(() => validateBackup(invalid), /Invalid backup record/)
  }
  const tooLong = withKind('business') as unknown as FatoratiBackup & { customers: Record<string, unknown>[] }
  tooLong.customers[0].state = 'x'.repeat(121)
  assert.throws(() => validateBackup(tooLong), /Invalid backup record/)
})

test('CSV export includes location and computed customer ledger without using stale stored balance', () => {
  const source = withKind(undefined) as unknown as FatoratiBackup & { customers: Record<string, unknown>[] }
  source.preferences.defaultCurrency = 'EUR'
  Object.assign(source.customers[0], { country: 'MA', city: 'Casablanca' })
  const rows = csvRows('customers', source)
  const header = rows[0] as string[]
  const kindIndex = header.indexOf('Kind')
  const countryIndex = header.indexOf('Country')
  const paidIndex = header.indexOf('Amount paid')
  const outstandingIndex = header.indexOf('Unpaid balance')
  const rankIndex = header.indexOf('Rank')
  assert.ok(kindIndex >= 0 && countryIndex >= 0 && paidIndex >= 0 && outstandingIndex >= 0 && rankIndex >= 0)
  assert.equal((rows[1] as unknown[])[kindIndex], 'business', 'a legacy kind exports as business')
  assert.equal((rows[1] as unknown[])[countryIndex], 'MA')
  assert.equal((rows[1] as unknown[])[paidIndex], '[{"currency":"EUR","amount":20}]')
  assert.equal((rows[1] as unknown[])[outstandingIndex], '[]')
  assert.equal((rows[1] as unknown[])[rankIndex], 1)
  const individual = withKind('individual')
  assert.equal((csvRows('customers', individual)[1] as unknown[])[kindIndex], 'individual')
})

test('CSV export no longer publishes the stored balance (stale by design)', () => {
  const rows = csvRows('customers', fixture())
  assert.equal((rows[0] as string[]).includes('Balance'), false)
  // The field itself is still accepted on import: old backups keep restoring.
  validateBackup(fixture())
})
