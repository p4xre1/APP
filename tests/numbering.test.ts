// Gap-free numbering: the per-series floor in Settings only rises, so a deleted
// document never frees its number and an imported backup continues its sequences.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextDocumentNumber, numberFloorKey, seriesFloor, raisedFloor, floorsFromNumbers } from '../src/lib/fatorati'
import { validateBackup, migrateBackup, encodeBackup, decodeBackup, BACKUP_VERSION } from '../src/lib/backup-format'
import { fixture, legacyFixture } from './fixtures'
import type { FatoratiBackup } from '../src/lib/db'

const DATE = new Date('2026-09-30T10:00:00')

test('create three, delete the last, create again: the number is 4, not 3', () => {
  // Three invoices created: the floor followed each save.
  let floor: Record<string, number> | undefined
  const numbers: string[] = []
  for (let i = 0; i < 3; i++) {
    const number = nextDocumentNumber(numbers, 'INV', 'INV', DATE, seriesFloor(floor, 'INV', 'INV', DATE))
    numbers.push(number)
    floor = raisedFloor(floor, number) ?? floor
  }
  assert.deepEqual(numbers, ['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003'])
  assert.deepEqual(floor, { 'INV-2026': 3 })
  // INV-2026-0003 is deleted, but the floor keeps its slot occupied.
  numbers.pop()
  assert.equal(nextDocumentNumber(numbers, 'INV', 'INV', DATE, seriesFloor(floor, 'INV', 'INV', DATE)), 'INV-2026-0004')
})

test('floor bookkeeping: raise, no-op, hand-typed and giant numbers', () => {
  assert.equal(numberFloorKey('INV', 'INV', DATE), 'INV-2026')
  assert.equal(numberFloorKey('!!!', 'EST', DATE), 'EST-2026')
  assert.deepEqual(raisedFloor(undefined, 'INV-2026-0003'), { 'INV-2026': 3 })
  // A second series is independent and the first one is preserved.
  assert.deepEqual(raisedFloor({ 'INV-2026': 3 }, 'EST-2026-0001'), { 'INV-2026': 3, 'EST-2026': 1 })
  // Lower or equal numbers change nothing: callers skip the settings write.
  assert.equal(raisedFloor({ 'INV-2026': 3 }, 'INV-2026-0002'), null)
  assert.equal(raisedFloor({ 'INV-2026': 3 }, 'INV-2026-0003'), null)
  // Legacy or hand-typed numbers outside PREFIX-YYYY-NNNN raise nothing.
  assert.equal(raisedFloor({}, 'INV-1'), null)
  assert.equal(raisedFloor({}, 'INV-202609-123'), null)
  // A giant number cannot push the floor past what the backup validator allows.
  assert.equal(raisedFloor({}, 'INV-2026-99999999'), null)
  assert.deepEqual(floorsFromNumbers(['INV-2026-0007', 'INV-2026-0002', 'EST-2026-0002', 'INV-1']),
    { 'INV-2026': 7, 'EST-2026': 2 })
})

test('a new year starts at 0001: the floor is keyed per year', () => {
  const floors = { 'INV-2026': 9 }
  assert.equal(seriesFloor(floors, 'INV', 'INV', DATE), 9)
  const nextYear = new Date('2027-01-01T09:00:00')
  assert.equal(seriesFloor(floors, 'INV', 'INV', nextYear), 0)
  assert.equal(nextDocumentNumber([], 'INV', 'INV', nextYear, seriesFloor(floors, 'INV', 'INV', nextYear)), 'INV-2027-0001')
  // Two prefixes never share a floor.
  assert.equal(seriesFloor(floors, 'EST', 'EST', DATE), 0)
})

test('importing an old backup computes the floor from its own numbers', () => {
  const legacy = legacyFixture() as unknown as FatoratiBackup & { settings: Record<string, unknown>[] }
  legacy.invoices[0].number = 'INV-2026-0007'
  legacy.estimates[0].number = 'EST-2026-0002'
  const migrated = migrateBackup(legacy)
  assert.equal(migrated.version, BACKUP_VERSION)
  assert.deepEqual((migrated.settings[0] as unknown as Record<string, unknown>).numberFloor, { 'INV-2026': 7, 'EST-2026': 2 })
  validateBackup(migrated)
})

test('legacy numbers outside the pattern leave the floor unset', () => {
  const migrated = migrateBackup(legacyFixture()) // fixture numbers are INV-1 / EST-1
  assert.equal((migrated.settings[0] as unknown as Record<string, unknown>).numberFloor, undefined)
  validateBackup(migrated)
})

test('a 3.2.0 file migrates and a floor already present is kept as-is', () => {
  const source = fixture() as unknown as FatoratiBackup & { settings: Record<string, unknown>[] }
  source.version = '3.2.0'
  source.settings[0].numberFloor = { 'INV-2026': 42 }
  source.invoices[0].number = 'INV-2026-0007'
  const migrated = migrateBackup(source)
  assert.equal(migrated.version, BACKUP_VERSION)
  assert.deepEqual((migrated.settings[0] as unknown as Record<string, unknown>).numberFloor, { 'INV-2026': 42 })
})

test('validation rejects malformed floors and accepts good ones', () => {
  const withFloor = (numberFloor: unknown) => {
    const backup = fixture() as unknown as { settings: Record<string, unknown>[] }
    backup.settings[0].numberFloor = numberFloor
    return backup
  }
  validateBackup(withFloor({ 'INV-2026': 3, 'EST-2026': 1 }))
  for (const bad of [
    { 'inv-2026': 1 },            // lowercase prefix
    { 'INV-26': 1 },              // year must be four digits
    { 'TOOLONGPREF-2026': 1 },    // prefix longer than 8 chars
    { 'INV-2026': 0 },            // floors start at 1
    { 'INV-2026': 1.5 },          // integers only
    { 'INV-2026': 2_000_000 },    // above the cap
    { 'INV-2026': '3' },          // strings rejected
    ['INV-2026'],                 // not a plain object
  ]) assert.throws(() => validateBackup(withFloor(bad)), /Invalid backup record/)
})

test('the floor survives an encrypted round-trip', async () => {
  const source = fixture() as unknown as FatoratiBackup & { settings: Record<string, unknown>[] }
  source.settings[0].numberFloor = { 'INV-2026': 3 }
  validateBackup(source)
  assert.deepEqual(await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é'), source)
})
