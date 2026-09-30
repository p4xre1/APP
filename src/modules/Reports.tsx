import { useFatorati } from '../store/useFatorati'
import { money, number } from '../lib/format'
import { reportTotals, agedReceivables, taxSummary } from '../lib/reports'
import { cashFlow, periodRange, type CashFlowPeriod } from '../lib/cash-flow'
import { useI18n, usePreferences } from '../i18n'
import { Fragment, useState } from 'react'

const PERIODS: { id: CashFlowPeriod; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
]

export default function Reports() {
  const { invoices, expenses, customers } = useFatorati()

  const { t } = useI18n(), prefs = usePreferences()
  const [period, setPeriod] = useState<CashFlowPeriod>('month')
  const result = reportTotals(invoices, expenses, prefs.defaultCurrency)
  const aged = agedReceivables(invoices, prefs.defaultCurrency)
  const range = periodRange(period)
  const flows = cashFlow(invoices, expenses, range.from, range.to, prefs.defaultCurrency)
  const taxRows = taxSummary(invoices, expenses, range.from, range.to, prefs.defaultCurrency)
  const rows = result.totals.length ? result.totals : [{currency:prefs.defaultCurrency,revenue:0,pending:0,overdue:0,received:0,expenses:0,tax:0,counts:{paid:0,sent:0,overdue:0,draft:0,total:0},profit:0}]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Reports')}</h1>
        <p className="text-[13px] text-muted mt-1">{t('Business reports • 100% offline')}</p>
      </div>

      {rows.map(row => {
        const { currency, revenue:totalRevenue, pending:pendingRevenue, overdue:overdueRevenue, received, expenses:totalExpenses, tax:totalTax, counts, profit } = row
        const currencyExpenses = expenses.filter(exp => (exp.currency || prefs.defaultCurrency) === currency)
        return <Fragment key={currency}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-line shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[13px] text-muted">{t('Revenue (paid, excl. tax)')}</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{money(totalRevenue,currency)}</p>
          <p className="text-[12px] text-muted mt-1">{number(counts.paid)} {t('invoices')}</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-line shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[13px] text-muted">{t('Pending Revenue')}</p>
          <p className="text-2xl font-bold text-brand mt-1">{money(pendingRevenue,currency)}</p>
          <p className="text-[12px] text-muted mt-1">{t('{sent} sent · {overdue} overdue',{sent:counts.sent,overdue:counts.overdue})} · {money(overdueRevenue,currency)} {t('overdue')}</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-line shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[13px] text-muted">{t('Total Expenses')}</p>
          <p className="text-2xl font-bold text-serious mt-1">{money(totalExpenses,currency)}</p>
          <p className="text-[12px] text-muted mt-1">{number(currencyExpenses.length)} {t('records')}</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[14px] font-bold text-ink mb-4">{t('Profit & Loss')}{rows.length > 1 && ` — ${currency}`}</h2>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-[13px] text-muted">{t('Revenue (paid, excl. tax)')}</span>
            <span className="text-[13px] font-medium text-emerald-700">{money(totalRevenue,currency)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-[13px] text-muted">{t('Tax collected (paid invoices)')}</span>
            <span className="text-[13px] font-medium text-ink">{money(totalTax,currency)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-[13px] text-muted">{t('Cash received (incl. tax)')}</span>
            <span className="text-[13px] font-medium text-ink">{money(received,currency)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-[13px] text-muted">{t('Expenses')}</span>
            <span className="text-[13px] font-medium text-serious">-{money(totalExpenses,currency)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-[13px] text-muted">{t('Documents by status')}</span>
            <span className="text-[13px] font-medium text-ink">{t('draft',{})} {number(counts.draft)} · {t('sent')} {number(counts.sent)} · {t('paid')} {number(counts.paid)} · {t('overdue')} {number(counts.overdue)}</span>
          </div>
          <div className="flex justify-between py-3 font-bold text-lg">
            <span>{t('Net result (cash, excl. tax)')}</span>
            <span className={profit >= 0 ? 'text-emerald-700' : 'text-serious'}>{money(profit,currency)}</span>
          </div>
        </div>
      </div>

      {(() => {
        const bucketRow = aged.find(entry => entry.currency === currency)
        if (!bucketRow || bucketRow.total === 0) return null
        const buckets: { label: string; value: number }[] = [
          { label: t('Not due yet'), value: bucketRow.notDue },
          { label: t('1–30 days late'), value: bucketRow.d1to30 },
          { label: t('31–60 days late'), value: bucketRow.d31to60 },
          { label: t('61–90 days late'), value: bucketRow.d61to90 },
          { label: t('Over 90 days late'), value: bucketRow.d90plus },
        ]
        return <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[14px] font-bold text-ink mb-4">{t('Aged receivables')}{rows.length > 1 && ` — ${currency}`}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            {buckets.map(bucket => (
              <div key={bucket.label} className="p-3 bg-canvas rounded-lg">
                <p className={`text-[15px] font-bold ${bucket.value > 0 && bucket.label !== t('Not due yet') ? 'text-serious' : 'text-ink'}`}>{money(bucket.value, currency)}</p>
                <p className="text-[11.5px] text-muted mt-1">{bucket.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-muted mt-3">{t('Open balances by days past the due date; partial payments and credit notes already deducted.')}</p>
        </div>
      })()}

      <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[14px] font-bold text-ink mb-4">{t('Summary')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-2xl font-bold text-ink">{number(customers.length)}</p>
            <p className="text-[12px] text-muted mt-1">{t('Customers')}</p>
          </div>
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-2xl font-bold text-ink">{number(counts.total)}</p>
            <p className="text-[12px] text-muted mt-1">{t('Invoices')}</p>
          </div>
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-2xl font-bold text-ink">{number(currencyExpenses.length)}</p>
            <p className="text-[12px] text-muted mt-1">{t('Expenses')}</p>
          </div>
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-2xl font-bold text-ink">{money(profit,currency)}</p>
            <p className="text-[12px] text-muted mt-1">{t('Net result')}</p>
          </div>
        </div>
      </div>
        </Fragment>
      })}
      <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-bold text-ink">{t('Cash flow')}</h2>
          <select aria-label={t('Period')} value={period} onChange={e => setPeriod(e.target.value as CashFlowPeriod)} className="text-[12px] rounded-lg border border-line-strong bg-surface text-ink px-2 py-1">
            {PERIODS.map(option => <option key={option.id} value={option.id}>{t(option.label)}</option>)}
          </select>
        </div>
        {flows.length === 0
          ? <p className="text-[13px] text-muted">{t('No cash moved in this period.')}</p>
          : flows.map(flow => (
            <div key={flow.currency} className="grid grid-cols-3 gap-3 text-center mb-3 last:mb-0">
              <div className="p-3 bg-canvas rounded-lg">
                <p className="text-[15px] font-bold text-emerald-700">{money(flow.moneyIn, flow.currency)}</p>
                <p className="text-[11.5px] text-muted mt-1">{t('Money in')}{flows.length > 1 && ` — ${flow.currency}`}</p>
              </div>
              <div className="p-3 bg-canvas rounded-lg">
                <p className="text-[15px] font-bold text-serious">{money(flow.moneyOut, flow.currency)}</p>
                <p className="text-[11.5px] text-muted mt-1">{t('Money out')}{flows.length > 1 && ` — ${flow.currency}`}</p>
              </div>
              <div className="p-3 bg-canvas rounded-lg">
                <p className={`text-[15px] font-bold ${flow.net >= 0 ? 'text-emerald-700' : 'text-serious'}`}>{money(flow.net, flow.currency)}</p>
                <p className="text-[11.5px] text-muted mt-1">{t('Net cash flow')}{flows.length > 1 && ` — ${flow.currency}`}</p>
              </div>
            </div>
          ))}
        <p className="text-[12px] text-muted mt-3">{t('Cash that actually moved: recorded payments and settled documents in, expenses and refunded credit notes out. Unpaid invoices are not cash.')}</p>
      </div>

      <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[14px] font-bold text-ink mb-1">{t('Tax summary (estimate)')}</h2>
        <p className="text-[12px] text-muted mb-4">{PERIODS.filter(option => option.id === period).map(option => t(option.label))}</p>
        {taxRows.length === 0
          ? <p className="text-[13px] text-muted">{t('Nothing settled in this period.')}</p>
          : taxRows.map(row => (
            <div key={row.currency} className="space-y-0 mb-3 last:mb-0">
              {taxRows.length > 1 && <p className="text-[12px] font-semibold text-muted mb-1">{row.currency}</p>}
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-[13px] text-muted">{t('Sales excluding tax')}</span>
                <span className="text-[13px] font-medium text-ink">{money(row.salesExclTax, row.currency)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-[13px] text-muted">{t('Tax collected on sales')}</span>
                <span className="text-[13px] font-medium text-ink">{money(row.taxCollected, row.currency)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-[13px] text-muted">{t('Purchases excluding recorded tax')}</span>
                <span className="text-[13px] font-medium text-ink">{money(row.purchasesExclTax, row.currency)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line">
                <span className="text-[13px] text-muted">{t('Deductible tax recorded on expenses')}</span>
                <span className="text-[13px] font-medium text-ink">{money(row.taxDeductible, row.currency)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold">
                <span className="text-[13px]">{t('Net tax position')}</span>
                <span className={`text-[13px] ${row.netTax >= 0 ? 'text-ink' : 'text-emerald-700'}`}>{money(row.netTax, row.currency)}</span>
              </div>
            </div>
          ))}
        <p className="text-[12px] text-muted mt-3">{t('An estimate built from settled documents and the tax you recorded on expenses. It is not a declaration — verify every figure with your accountant before filing.')}</p>
      </div>

      <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[14px] font-bold text-ink mb-4">{t('Converted net total')}</h2>
        <p className="text-2xl font-bold text-ink">{money(result.converted,prefs.defaultCurrency)}</p>
        <p className="text-[13px] text-muted mt-1">{t('Manual rates only')}</p>
        {result.missing > 0 && <p className="text-[13px] text-warn mt-1">{t('Missing rates',{count:number(result.missing)})}</p>}
      </div>
    </div>
  )
}
