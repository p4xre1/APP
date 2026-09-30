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

test('kind survives an encrypted round-trip', async () => {
  const source = withKind('individual')
  assert.deepEqual(await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é'), source)
})

test('CSV export has a Kind column; a legacy record exports as business', () => {
  const rows = csvRows('customers', withKind(undefined))
  const header = rows[0] as string[]
  const kindIndex = header.indexOf('Kind')
  assert.ok(kindIndex >= 0, 'header has a Kind column')
  assert.equal((rows[1] as string[])[kindIndex], 'business')
  const individual = csvRows('customers', withKind('individual'))
  assert.equal((individual[1] as string[])[kindIndex], 'individual')
})

test('CSV export no longer publishes the stored balance (stale by design)', () => {
  const rows = csvRows('customers', fixture())
  assert.equal((rows[0] as string[]).includes('Balance'), false)
  // The field itself is still accepted on import: old backups keep restoring.
  validateBackup(fixture())
})
