import { test } from 'node:test'
import assert from 'node:assert/strict'
import { invoiceBucket, isOverdueInvoice, isPendingInvoice, reportTotals } from '../src/lib/reports'
import { groupInvoices, groupModes, hasProjectLinks } from '../src/lib/revenue'
import { fixture } from './fixtures'
import type { Invoice } from '../src/store/types'

const base = fixture().invoices[0]
const today = new Date('2026-09-29T12:00:00Z')
const invoice = (patch: Partial<Invoice>): Invoice => ({ ...base, projectId: undefined, ...patch })

const paid = invoice({ id: 'paid', number: 'INV-P', status: 'paid', total: 100, dueDate: '2026-09-10' })
const sent = invoice({ id: 'sent', number: 'INV-S', status: 'sent', total: 50, dueDate: '2026-10-20' })
const overdueStatus = invoice({ id: 'overdue', number: 'INV-O', status: 'overdue', total: 30, dueDate: '2026-10-20' })
const sentLate = invoice({ id: 'sent-late', number: 'INV-L', status: 'sent', total: 20, dueDate: '2026-09-01' })
const draft = invoice({ id: 'draft', number: 'INV-D', status: 'draft', total: 500, dueDate: '2026-09-01' })
const all = [paid, sent, overdueStatus, sentLate, draft]

test('pending counts Sent AND Overdue invoices; drafts are never counted', () => {
  assert.equal(isPendingInvoice(sent, today), true)
  assert.equal(isPendingInvoice(overdueStatus, today), true)
  // A sent invoice whose due date passed is both pending and overdue.
  assert.equal(isPendingInvoice(sentLate, today), true)
  assert.equal(isOverdueInvoice(sentLate, today), true)
  assert.equal(isPendingInvoice(draft, today), false, 'drafts are not pending')
  assert.equal(isOverdueInvoice(draft, today), false, 'drafts are not overdue')
  assert.equal(isPendingInvoice(paid, today), false)
})

test('each card number has the matching invoice list, count and overdue line', () => {
  const bucket = invoiceBucket(all, [], 'EUR', 'EUR', today)
  assert.equal(bucket.revenue, 100)
  assert.equal(bucket.pending, 100, 'sent 50 + overdue 30 + late sent 20')
  assert.equal(bucket.overdue, 50, 'explicit overdue 30 + late sent 20')
  assert.deepEqual(bucket.counts, { paid: 1, pending: 3, overdue: 2, drafts: 1, expenses: 0 })
  assert.deepEqual(bucket.invoices.paid.map(row => row.id), ['paid'])
  assert.deepEqual(bucket.invoices.pending.map(row => row.id).sort(), ['overdue', 'sent', 'sent-late'])
  assert.deepEqual(bucket.invoices.overdue.map(row => row.id).sort(), ['overdue', 'sent-late'])
  assert.equal(bucket.profit, 100)
})

test('reportTotals keeps currencies separate and exposes the same buckets', () => {
  const usd = invoice({ id: 'usd', status: 'paid', total: 7, currency: 'USD', rateCurrency: undefined, exchangeRate: undefined })
  const expense = { ...fixture().expenses[0], amount: 12, currency: 'EUR' }
  const result = reportTotals([...all, usd], [expense], 'EUR', today)
  const eur = result.totals.find(row => row.currency === 'EUR')!
  const usdRow = result.totals.find(row => row.currency === 'USD')!
  assert.equal(eur.revenue, 100)
  assert.equal(eur.expenses, 12)
  assert.equal(eur.profit, 88)
  assert.equal(usdRow.revenue, 7)
  assert.equal(usdRow.pending, 0)
  assert.equal(result.converted, 88, 'paid EUR 100 - expenses 12; the USD document has no rate')
  assert.equal(result.missing, 1, 'USD has no manual rate to EUR')
})

test('revenue can be grouped by client, project or month with percentages of the total', () => {
  const source = fixture()
  const customers = [
    { ...source.customers[0], id: 'a', name: 'Alpha' },
    { ...source.customers[0], id: 'b', name: 'Beta' },
  ]
  const projects = [{ ...source.projects[0], id: 'p1', name: 'Website' }]
  const rows = [
    invoice({ id: 'a1', customerId: 'a', projectId: 'p1', total: 75, occurredAt: Date.UTC(2026, 8, 5) }),
    invoice({ id: 'b1', customerId: 'b', total: 25, occurredAt: Date.UTC(2026, 8, 20) }),
    invoice({ id: 'b2', customerId: 'b', total: 100, occurredAt: Date.UTC(2026, 7, 2) }),
  ]
  const byClient = groupInvoices(rows, 'client', { currency: 'EUR', defaultCurrency: 'EUR', customers })
  assert.deepEqual(byClient.map(row => [row.label, row.total, row.count]), [['Beta', 125, 2], ['Alpha', 75, 1]])
  assert.equal(Math.round(byClient.reduce((sum, row) => sum + row.percent, 0) * 100), 100)
  const byProject = groupInvoices(rows, 'project', { currency: 'EUR', defaultCurrency: 'EUR', projects, noProjectLabel: 'No project' })
  assert.deepEqual(byProject.map(row => [row.label, row.total]), [['No project', 125], ['Website', 75]])
  const byMonth = groupInvoices(rows, 'month', { currency: 'EUR', defaultCurrency: 'EUR', timeZone: 'UTC', language: 'en' })
  assert.equal(byMonth.length, 2)
  assert.deepEqual(byMonth.map(row => row.total), [100, 100], 'September 75+25 and August 100')
})

test('project grouping is only offered when invoices are linked to projects', () => {
  assert.equal(hasProjectLinks([paid, sent]), false)
  assert.deepEqual(groupModes([paid, sent]), ['client', 'month'])
  assert.deepEqual(groupModes([{ ...paid, projectId: 'p1' }]), ['client', 'project', 'month'])
})
