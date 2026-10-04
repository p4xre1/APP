import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { documentTotals, taxAmount, lineTotal, roundMoney } from '../src/lib/format'
import { nextDocumentNumber, normalizePrefix } from '../src/lib/fatorati'
import { reportTotals } from '../src/lib/reports'
import { chartData } from '../src/lib/chart-data'
import { exportBackup, importBackup, add, update, remove, getAll } from '../src/lib/db'
import { normalizeRecord } from '../src/lib/backup-format'
import { createOrChangePin, lockVault, isUnlocked, unlockedSnapshot } from '../src/lib/vault'
import { fixture } from './fixtures'
import type { Invoice } from '../src/store/types'

beforeEach(async () => { lockVault(); globalThis.indexedDB = new IDBFactory(); await createOrChangePin('123456') })

test('tax uses integer minor units for 0, 2 and 3 decimal currencies', () => {
  assert.equal(taxAmount(100, 20, 'USD'), 20)
  assert.equal(taxAmount(0.005, 20, 'USD'), 0) // 0.001 -> rounds to 0.00
  assert.equal(taxAmount(99.99, 20, 'USD'), 20) // 19.998 -> 20.00
  assert.equal(taxAmount(100, 20, 'JPY'), 20)
  assert.equal(taxAmount(101, 20, 'JPY'), 20) // 20.2 -> 20 (no minor units)
  assert.equal(taxAmount(1.234, 20, 'KWD'), 0.247) // 0.2468 -> 0.247
  assert.equal(taxAmount(100, 0, 'USD'), 0)
  assert.equal(taxAmount(100, undefined, 'USD'), 0)
  assert.throws(() => taxAmount(100, 1001, 'USD'), /Invalid tax rate/)
})

test('document totals add tax on top of a rounded subtotal, never on the raw floats', () => {
  const lines = [{ quantity: 3, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }]
  assert.equal(lineTotal(3, 0.1, 'USD'), 0.3)
  const totals = documentTotals(lines, 10, 'USD')
  assert.equal(totals.subtotal, 0.5)
  assert.equal(totals.tax, 0.05)
  assert.equal(totals.total, 0.55)
  assert.deepEqual(documentTotals([], 20, 'USD'), { subtotal: 0, tax: 0, total: 0 })
  assert.equal(roundMoney(totals.total, 'USD'), 0.55)
})

test('a line discount survives every write path and every backup round-trip', async () => {
  // Regression: normalizeRecord() rebuilt each line as quantity × unit price and
  // dropped item.discount, so saving or importing a discounted document rewrote the
  // line to the undiscounted amount while subtotal/total kept the discount.
  const line = { id: 'item-1', description: 'Casque audio', quantity: 3, unitPrice: 99.9, discount: 10 }
  const totals = documentTotals([line], 0, 'USD')
  // A complete invoice (the fixture row minus its ids), so exportBackup validates it.
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...seed } = fixture().invoices[0]
  const payload = {
    ...seed, currency: 'USD', taxRate: 0, status: 'draft' as const, paidAt: undefined,
    items: [{ ...line, total: lineTotal(line.quantity, line.unitPrice, 'USD', line.discount) }],
    ...totals,
  }
  const saved = await add<Invoice>('invoices', payload as never)
  assert.equal(saved.items[0].total, 269.73, 'the stored line matches the discounted form value')
  assert.deepEqual([saved.subtotal, saved.tax, saved.total], [269.73, 0, 269.73])

  // The stored row and the backup built from it keep the discounted line.
  const stored = (await getAll<Invoice>('invoices'))[0]
  assert.equal(stored.items[0].total, 269.73)
  const backup = await exportBackup()
  assert.equal(backup.invoices[0].items[0].total, 269.73)

  // A record written by an older build (undiscounted total) is repaired on the next
  // write or import, because the discount is part of the normalisation rule.
  const legacy = normalizeRecord('invoices', { ...stored, items: [{ ...stored.items[0], total: 299.7 }] }, 'USD')
  assert.equal((legacy.items as { total: number }[])[0].total, 269.73)
})

test('document numbers are sequential, prefix-normalized and never duplicate an existing number', () => {
  assert.equal(normalizePrefix(' inv ', 'INV'), 'INV')
  assert.equal(normalizePrefix('!!!', 'INV'), 'INV')
  assert.equal(normalizePrefix('a'.repeat(20), 'INV'), 'AAAAAAAA')
  const date = new Date('2026-09-30T10:00:00Z')
  assert.equal(nextDocumentNumber([], 'INV', 'INV', date), 'INV-2026-0001')
  assert.equal(nextDocumentNumber(['INV-2026-0001', 'INV-2026-0002'], 'INV', 'INV', date), 'INV-2026-0003')
  // A gap stays a gap: the number after a deleted document is not reused.
  assert.equal(nextDocumentNumber(['INV-2026-0005'], 'INV', 'INV', date), 'INV-2026-0006')
  // Numbers from another year do not advance this year's sequence.
  assert.equal(nextDocumentNumber(['INV-2025-9999'], 'INV', 'INV', date), 'INV-2026-0001')
  // A legacy random number never collides with the new series.
  assert.equal(nextDocumentNumber(['INV-202609-123'], 'INV', 'INV', date), 'INV-2026-0001')
  // A hand-typed duplicate is skipped rather than reused.
  assert.equal(nextDocumentNumber(['INV-2026-0001', 'INV-2026-0001'], 'INV', 'INV', date), 'INV-2026-0002')
})

test('status workflow drives revenue, counts and charts', () => {
  const base = { currency: 'USD', occurredAt: 0, createdAt: 0, updatedAt: 0, tax: 2, subtotal: 10, total: 12 }
  const invoices = [
    { ...base, id: 'a', number: 'INV-1', customerId: 'c', items: [], status: 'paid', issueDate: '2026-01-01', dueDate: '2026-01-31', notes: '', paidAt: Date.UTC(2026, 0, 10) },
    { ...base, id: 'b', number: 'INV-2', customerId: 'c', items: [], status: 'sent', issueDate: '2026-01-01', dueDate: '2026-01-31', notes: '' },
    { ...base, id: 'c', number: 'INV-3', customerId: 'c', items: [], status: 'overdue', issueDate: '2026-01-01', dueDate: '2026-01-31', notes: '' },
  ] as unknown as Invoice[]
  // Updated with the 2.2.0 accounting fix: the old expectations (revenue 12,
  // tax 6, pending 12) counted tax inside revenue, summed tax across drafts and
  // unsent invoices, and hid overdue money from pending. Correct figures:
  // revenue = paid total minus its tax, tax = paid tax only, pending = the full
  // amount still owed (sent + overdue, incl. tax).
  // Pinned "today" before the due date, so the sent invoice is not overdue yet.
  const result = reportTotals(invoices, [], 'USD', '2026-01-15')
  const usd = result.totals.find(row => row.currency === 'USD')!
  assert.equal(usd.revenue, 10)
  assert.equal(usd.tax, 2)
  assert.equal(usd.received, 12)
  assert.equal(usd.pending, 24)
  assert.equal(usd.overdue, 12)
  assert.deepEqual(usd.counts, { paid: 1, sent: 1, overdue: 1, draft: 0, total: 3 })
  const charts = chartData(invoices, [], 'USD', 12, Date.UTC(2026, 0, 15), 'UTC', 'en-US')
  assert.equal(charts.revenue.reduce((a, b) => a + b, 0), 10) // only the paid invoice, tax-free
})

test('editing a record keeps the session cache correct without a full reload', async () => {
  await importBackup(fixture(), 'replace')
  await add<{ id: string; createdAt: number; updatedAt: number; name: string; email: string; phone: string; address: string; city: string; notes: string; balance: number }>('customers', { name: 'قريبة', email: '', phone: '', address: '', city: '', notes: '', balance: 0 })
  let customers = await getAll<{ id: string; name: string }>('customers')
  assert.equal(customers.length, 2)
  assert.equal(customers[1].name, 'قريبة')
  await update<{ id: string; updatedAt: number; name: string }>('customers', customers[1].id, { name: 'بعد التعديل' })
  customers = await getAll<{ id: string; name: string }>('customers')
  assert.equal(customers[1].name, 'بعد التعديل')
  await remove('customers', customers[1].id)
  assert.equal((await getAll('customers')).length, 1)
  // The cache is dropped on lock, and the next unlock reads the same data back.
  lockVault()
  assert.equal(isUnlocked(), false)
  await assert.rejects(unlockedSnapshot(), /locked/)
  await (await import('../src/lib/vault')).unlockPin('123456')
  assert.equal((await getAll('customers')).length, 1)
  const backup = await exportBackup()
  assert.equal(backup.customers[0].name, 'عميل André')
})

test('tax rate and payment date survive a backup round-trip', async () => {
  const invoice = { ...fixture().invoices[0], taxRate: 19, tax: 3.8, total: 23.8, status: 'paid' as const, paidAt: 1_700_000_000_000 }
  await importBackup({ ...fixture(), invoices: [invoice] }, 'replace')
  const stored = (await exportBackup()).invoices[0]
  assert.equal(stored.taxRate, 19)
  assert.equal(stored.paidAt, 1_700_000_000_000)
  assert.equal(stored.status, 'paid')
})
