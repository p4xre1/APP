// Payments: partial, multiple, full, over-payment rejection, balance, and how
// the open balance flows into receivables. All rules in src/lib/payments.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paymentsTotal, invoiceBalance, validatePayment, recordPayment, removePayment } from '../src/lib/payments'
import { customerOutstanding } from '../src/lib/status'
import { reportTotals } from '../src/lib/reports'
import { csvRows } from '../src/lib/csv'
import { validateBackup, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { fixture } from './fixtures'
import type { Invoice, InvoicePayment } from '../src/store/types'
import type { FatoratiBackup } from '../src/lib/db'

const TODAY = '2026-09-30'
const pay = (amount: number, date = '2026-09-10', patch: Partial<InvoicePayment> = {}): InvoicePayment =>
  ({ id: `p-${amount}-${date}`, amount, date, ...patch })
const invoice = (patch: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-1', number: 'INV-2026-0001', customerId: 'c1', items: [], notes: '',
  subtotal: 1000, tax: 0, total: 1000, status: 'sent', currency: 'USD',
  issueDate: '2026-09-01', dueDate: '2026-12-31', occurredAt: 0, createdAt: 0, updatedAt: 0, ...patch,
} as Invoice)

test('the 1000 = 300 + 400 + 300 example: balance reaches zero, status derives to paid', () => {
  let row = invoice()
  assert.equal(invoiceBalance(row, 'USD'), 1000)
  for (const [amount, expected] of [[300, 700], [400, 300]] as const) {
    const patch = recordPayment(row, { amount, date: '2026-09-10' }, 'USD')
    row = { ...row, ...patch }
    assert.equal(row.status, 'sent', 'a partial payment is a balance, not a status')
    assert.equal(invoiceBalance(row, 'USD'), expected)
  }
  const final = recordPayment(row, { amount: 300, date: '2026-09-20' }, 'USD')
  row = { ...row, ...final }
  assert.equal(row.status, 'paid', 'full coverage derives the paid status')
  assert.ok(row.paidAt, 'paidAt is set from the payment date')
  assert.equal(invoiceBalance(row, 'USD'), 0)
  assert.equal(paymentsTotal(row, 'USD'), 1000)
})

test('over-payments and nonsense are rejected; zero balance takes nothing more', () => {
  const row = invoice({ payments: [pay(700)] })
  assert.throws(() => validatePayment(row, 301, '2026-09-10', 'USD'), /cannot exceed the remaining balance/)
  assert.throws(() => validatePayment(row, 0, '2026-09-10', 'USD'), /greater than zero/)
  assert.throws(() => validatePayment(row, -5, '2026-09-10', 'USD'), /greater than zero/)
  assert.throws(() => validatePayment(row, 100, 'not-a-date', 'USD'), /valid payment date/)
  validatePayment(row, 300, '2026-09-10', 'USD') // exactly the balance is fine
  const settled = invoice({ status: 'paid' })
  assert.throws(() => validatePayment(settled, 1, '2026-09-10', 'USD'), /cannot exceed/)
  // Credit notes settle by status, never by payments.
  assert.throws(() => validatePayment(invoice({ kind: 'credit_note' }), 100, '2026-09-10', 'USD'), /credit note takes no payments/)
})

test('a legacy invoice marked paid without recorded payments is settled', () => {
  const legacy = invoice({ status: 'paid', payments: undefined })
  assert.equal(invoiceBalance(legacy, 'USD'), 0)
  assert.equal(paymentsTotal(legacy, 'USD'), 0, 'no synthetic payment is invented')
})

test('removing a payment re-opens a paid invoice', () => {
  let row = invoice({ status: 'paid', paidAt: 5, payments: [pay(600), pay(400, '2026-09-20')] })
  const patch = removePayment(row, 'p-400-2026-09-20', 'USD')
  row = { ...row, ...patch }
  assert.equal(row.status, 'sent')
  assert.equal(row.paidAt, undefined)
  assert.equal(invoiceBalance(row, 'USD'), 400)
  // Removing a partial payment from an open invoice only changes the balance.
  const open = invoice({ payments: [pay(300)] })
  assert.deepEqual(removePayment(open, 'p-300-2026-09-10', 'USD'), { payments: [] })
})

test('partial payments reduce receivables everywhere: outstanding, pending, overdue', () => {
  const rows = [
    invoice({ id: 'a', payments: [pay(300)] }),                                      // sent: owes 700
    invoice({ id: 'b', number: 'INV-2026-0002', dueDate: '2026-09-01', payments: [pay(250)] }), // effectively overdue: owes 750
  ]
  assert.deepEqual(customerOutstanding(rows, 'c1', 'USD', TODAY), [{ currency: 'USD', amount: 1450 }])
  const [report] = reportTotals(rows, [], 'USD', TODAY).totals
  assert.equal(report.pending, 1450)
  assert.equal(report.overdue, 750)
  // Revenue recognition is untouched: nothing is paid yet.
  assert.equal(report.revenue, 0)
  assert.equal(report.received, 0)
})

test('backup: payments validated per entry, rounded on import, round-trip intact', async () => {
  const source = fixture() as unknown as FatoratiBackup & { invoices: Record<string, unknown>[] }
  source.invoices[0].payments = [pay(5, '2026-01-05', { method: 'Cash', reference: 'CHQ-1', notes: 'первый' })]
  validateBackup(source)
  assert.deepEqual(await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é'), source)
  const raw = source.invoices as unknown as Record<string, unknown>[]
  for (const bad of [
    [{ ...pay(5), id: '' }],                       // empty id
    [pay(5), pay(5)],                              // duplicate ids
    [{ ...pay(5), amount: 0 }],                    // non-positive amount
    [{ ...pay(5), amount: 'x' }],                  // non-numeric amount
    [{ ...pay(5), date: '2026-13-45' }],           // malformed date
    [{ ...pay(5), method: 'x'.repeat(121) }],      // method too long
    'not-an-array',
  ]) {
    raw[0].payments = bad
    assert.throws(() => validateBackup(source), /Invalid backup record/, JSON.stringify(bad).slice(0, 40))
  }
  delete raw[0].payments // every pre-payments backup stays valid
  validateBackup(source)
})

test('CSV invoices export shows Amount Paid and Balance', () => {
  const source = fixture() as unknown as FatoratiBackup & { invoices: Record<string, unknown>[] }
  const rows = csvRows('invoices', source)
  const header = rows[0] as string[]
  const paidIndex = header.indexOf('Amount Paid')
  const balanceIndex = header.indexOf('Balance')
  assert.ok(paidIndex >= 0 && balanceIndex >= 0)
  // The fixture invoice is paid: fully received, zero balance.
  assert.equal((rows[1] as unknown[])[paidIndex], (source.invoices[0] as { total: number }).total)
  assert.equal((rows[1] as unknown[])[balanceIndex], 0)
})
