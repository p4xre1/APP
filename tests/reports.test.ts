import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reportTotals } from '../src/lib/reports'
import { chartData } from '../src/lib/chart-data'
import { fixture } from './fixtures'
import type { Invoice, Expense } from '../src/store/types'

const TODAY = '2026-09-30'

/** Two currencies, all four effective statuses, tax everywhere. */
function scenario() {
  const base = fixture().invoices[0]
  const invoices: Invoice[] = [
    // USD: paid 1200 incl. 200 tax; sent (not yet due) 600 incl. 100; sent past
    // due 300 incl. 50 (effectively overdue); draft 999 incl. 166.5 (ignored).
    { ...base, id: 'usd-paid', currency: 'USD', status: 'paid', subtotal: 1000, tax: 200, total: 1200, dueDate: '2026-09-01', paidAt: Date.UTC(2026, 8, 10) },
    { ...base, id: 'usd-sent', currency: 'USD', status: 'sent', subtotal: 500, tax: 100, total: 600, dueDate: '2026-10-15' },
    { ...base, id: 'usd-late', currency: 'USD', status: 'sent', subtotal: 250, tax: 50, total: 300, dueDate: '2026-09-15' },
    { ...base, id: 'usd-draft', currency: 'USD', status: 'draft', subtotal: 832.5, tax: 166.5, total: 999, dueDate: '2026-09-01' },
    // MAD: one manually overdue invoice and one paid without tax.
    { ...base, id: 'mad-over', currency: 'MAD', status: 'overdue', subtotal: 400, tax: 80, total: 480, dueDate: '2026-12-31' },
    { ...base, id: 'mad-paid', currency: 'MAD', status: 'paid', subtotal: 700, tax: 0, total: 700, dueDate: '2026-09-01', paidAt: Date.UTC(2026, 8, 5) },
  ]
  const expenses: Expense[] = [
    { ...fixture().expenses[0], id: 'usd-exp', currency: 'USD', amount: 150 },
    { ...fixture().expenses[0], id: 'mad-exp', currency: 'MAD', amount: 100 },
  ]
  return { invoices, expenses }
}

test('per currency: tax from paid only, revenue excl. tax, pending includes overdue, net result reconciles', () => {
  const { invoices, expenses } = scenario()
  const { totals } = reportTotals(invoices, expenses, 'USD', TODAY)
  const usd = totals.find(row => row.currency === 'USD')!
  // Paid: 1200 incl. 200 tax -> revenue 1000, tax 200, received 1200.
  assert.equal(usd.revenue, 1000)
  assert.equal(usd.tax, 200, 'draft and sent tax is not collected')
  assert.equal(usd.received, 1200)
  assert.equal(usd.revenue + usd.tax, usd.received, 'revenue excl. tax + tax collected = cash received')
  // Pending: sent 600 + effectively overdue 300; the draft 999 appears nowhere.
  assert.equal(usd.pending, 900)
  assert.equal(usd.overdue, 300)
  assert.equal(usd.expenses, 150)
  assert.equal(usd.profit, 850, 'net result = revenue excl. tax - expenses')
  assert.deepEqual(usd.counts, { paid: 1, sent: 1, overdue: 1, draft: 1, total: 4 })

  const mad = totals.find(row => row.currency === 'MAD')!
  assert.equal(mad.revenue, 700)
  assert.equal(mad.tax, 0)
  assert.equal(mad.pending, 480, 'a manual overdue is outstanding')
  assert.equal(mad.overdue, 480)
  assert.equal(mad.profit, 600)
  assert.deepEqual(mad.counts, { paid: 1, sent: 0, overdue: 1, draft: 0, total: 2 })
})

test('the converted total is tax-free and counts documents without a usable manual rate', () => {
  const { invoices, expenses } = scenario()
  const converted = reportTotals(invoices, expenses, 'USD', TODAY)
  // USD paid contributes 1000 (not 1200); USD expense -150. The MAD paid invoice
  // and the MAD expense have no manual rate -> 2 documents omitted.
  assert.equal(converted.converted, 850)
  assert.equal(converted.missing, 2)

  const withRate = invoices.map(row => row.id === 'mad-paid' ? { ...row, exchangeRate: 0.1, rateCurrency: 'USD' } : row)
  const result = reportTotals(withRate, expenses, 'USD', TODAY)
  assert.equal(result.converted, 920, '700 MAD x 0.1, tax-free')
  assert.equal(result.missing, 1)
})

test('the monthly revenue series is tax-free and lands in the payment month', () => {
  const { invoices, expenses } = scenario()
  const now = Date.UTC(2026, 8, 20)
  const data = chartData(invoices, expenses, 'USD', 2, now, 'UTC', 'en')
  assert.deepEqual(data.keys, ['2026-08', '2026-09'])
  assert.deepEqual(data.revenue, [0, 1000], 'total 1200 minus 200 tax, in the paidAt month')
})

test('the dashboard and the Reports screen read the same reportTotals function', () => {
  for (const file of ['src/modules/Dashboard.tsx', 'src/modules/Reports.tsx']) {
    const source = readFileSync(file, 'utf8')
    // Extra names (agedReceivables, …) are fine as long as they come from the same canonical module.
    assert.match(source, /import \{ reportTotals[^}]*\} from '\.\.\/lib\/reports'/, file)
    assert.match(source, /reportTotals\(/, file)
    assert.equal(/status\s*===\s*'paid'/.test(source), false, `${file} must not re-derive paid counts by itself`)
  }
})

test('the old mislabelled figures are gone: no tax-inclusive revenue label, no draft tax', () => {
  const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8')) as Record<string, string>
  for (const stale of ['Total Revenue (Paid)', 'Net Profit', 'Revenue (Paid Invoices)', 'Tax collected']) {
    assert.equal(stale in en, false, `stale key still shipped: ${stale}`)
  }
  for (const fresh of ['Revenue (paid, excl. tax)', 'Net result (cash, excl. tax)', 'Tax collected (paid invoices)', 'Cash received (incl. tax)']) {
    assert.equal(typeof en[fresh], 'string', `missing key: ${fresh}`)
  }
})
