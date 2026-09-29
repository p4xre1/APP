import { useFatorati } from '../store/useFatorati'
import { money, number } from '../lib/format'
import { reportTotals } from '../lib/reports'
import { useI18n, usePreferences } from '../i18n'
import { Fragment, useState } from 'react'
import MoneyDetails from '../components/MoneyDetails'
import RevenueInfo from '../components/RevenueInfo'
import RevenueShare from '../components/RevenueShare'
import { money as formatMoney } from '../lib/fatorati'

type DetailKind = 'paid' | 'pending' | 'expenses' | null

export default function Reports() {
  const { invoices, expenses, customers, projects, business } = useFatorati()
  const { t } = useI18n(), prefs = usePreferences()
  const result = reportTotals(invoices, expenses, prefs.defaultCurrency)
  const rows = result.totals.length ? result.totals : [{currency:prefs.defaultCurrency,revenue:0,pending:0,overdue:0,expenses:0,profit:0,counts:{paid:0,pending:0,overdue:0,drafts:0,expenses:0},breakdown:{paid:[],pending:[],overdue:[]}}]
  const [detail, setDetail] = useState<{ kind: DetailKind; currency: string }>({ kind: null, currency: prefs.defaultCurrency })
  const active = detail.kind ? rows.find(row => row.currency === detail.currency) || rows[0] : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Reports')}</h1>
          <p className="text-[13px] text-muted mt-1">{t('Business reports • 100% offline')}</p>
        </div>
        <RevenueShare invoices={invoices} business={business} currency={prefs.defaultCurrency} defaultCurrency={prefs.defaultCurrency} />
      </div>

      {rows.map(row => {
        const { currency, revenue:totalRevenue, pending:pendingRevenue, overdue:overdueRevenue, expenses:totalExpenses, profit, counts } = row
        const currencyInvoices = invoices.filter(inv => (inv.currency || prefs.defaultCurrency) === currency)
        const currencyExpenses = expenses.filter(exp => (exp.currency || prefs.defaultCurrency) === currency)
        return <Fragment key={currency}>
      <div className="flex items-center gap-2">
        <h2 className="text-[14px] font-bold text-ink">{t('Revenue overview')}{rows.length > 1 ? ` — ${currency}` : ''}</h2>
        <RevenueInfo />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => setDetail({ kind: 'paid', currency })} className="rounded-xl border border-line bg-surface p-5 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-[13px] text-muted">{t('Total Revenue (Paid)')}</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 break-words">{money(totalRevenue,currency)}</p>
          <p className="text-[12px] text-muted mt-1">{t('Sum of invoices marked as Paid · {count} invoices', { count: counts.paid })}</p>
        </button>
        <button onClick={() => setDetail({ kind: 'pending', currency })} className="rounded-xl border border-line bg-surface p-5 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-[13px] text-muted">{t('Pending Revenue')}</p>
          <p className="text-2xl font-bold text-brand mt-1 break-words">{money(pendingRevenue,currency)}</p>
          <p className="text-[12px] text-muted mt-1">{t('Sum of invoices marked as Sent or Overdue · {count} invoices', { count: counts.pending })}</p>
          <p className={`text-[12px] mt-1 ${overdueRevenue > 0 ? 'font-semibold text-serious' : 'text-muted'}`}>{t('Overdue: {amount} ({count} invoices)', { amount: money(overdueRevenue, currency), count: counts.overdue })}</p>
        </button>
        <button onClick={() => setDetail({ kind: 'expenses', currency })} className="rounded-xl border border-line bg-surface p-5 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-[13px] text-muted">{t('Total Expenses')}</p>
          <p className="text-2xl font-bold text-serious mt-1 break-words">{money(totalExpenses,currency)}</p>
          <p className="text-[12px] text-muted mt-1">{t('Sum of all expenses · {count} records', { count: counts.expenses })}</p>
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[14px] font-bold text-ink mb-4">{t('Profit & Loss')}{rows.length > 1 && ` — ${currency}`}</h2>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-[13px] text-muted">{t('Revenue (Paid Invoices)')}</span>
            <span className="text-[13px] font-medium text-emerald-700">{money(totalRevenue,currency)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-[13px] text-muted">{t('Expenses')}</span>
            <span className="text-[13px] font-medium text-serious">-{money(totalExpenses,currency)}</span>
          </div>
          <div className="flex justify-between py-3 font-bold text-lg">
            <span>{t('Net Profit')}</span>
            <span className={profit >= 0 ? 'text-emerald-700' : 'text-serious'}>{money(profit,currency)}</span>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[14px] font-bold text-ink mb-4">{t('Summary')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-2xl font-bold text-ink">{number(customers.length)}</p>
            <p className="text-[12px] text-muted mt-1">{t('Customers')}</p>
          </div>
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-2xl font-bold text-ink">{number(currencyInvoices.length)}</p>
            <p className="text-[12px] text-muted mt-1">{t('Invoices')}</p>
          </div>
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-2xl font-bold text-ink">{number(currencyExpenses.length)}</p>
            <p className="text-[12px] text-muted mt-1">{t('Expenses')}</p>
          </div>
          <div className="p-4 bg-canvas rounded-lg">
            <p className="text-2xl font-bold text-ink">{money(profit,currency)}</p>
            <p className="text-[12px] text-muted mt-1">{t('Profit')}</p>
          </div>
        </div>
      </div>
        </Fragment>
      })}
      <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[14px] font-bold text-ink mb-4">{t('Converted net total')}</h2>
        <p className="text-2xl font-bold text-ink">{money(result.converted,prefs.defaultCurrency)}</p>
        <p className="text-[13px] text-muted mt-1">{t('Manual rates only')}</p>
        {result.missing > 0 && <p className="text-[13px] text-warn mt-1">{t('Missing rates',{count:number(result.missing)})}</p>}
      </div>

      {active && <MoneyDetails
        open={!!detail.kind}
        onClose={() => setDetail({ kind: null, currency: detail.currency })}
        title={detail.kind === 'paid' ? t('Total Revenue (Paid)') : detail.kind === 'pending' ? t('Pending Revenue') : t('Total Expenses')}
        definition={detail.kind === 'paid'
          ? t('Sum of invoices marked as Paid · {count} invoices', { count: active.counts.paid })
          : detail.kind === 'pending'
            ? `${t('Sum of invoices marked as Sent or Overdue · {count} invoices', { count: active.counts.pending })}. ${t('Overdue: {amount} ({count} invoices)', { amount: formatMoney(active.overdue, active.currency), count: active.counts.overdue })}`
            : t('Sum of all expenses · {count} records', { count: active.counts.expenses })}
        currency={active.currency}
        invoices={detail.kind === 'paid' ? active.breakdown.paid : detail.kind === 'pending' ? active.breakdown.pending : undefined}
        expenses={detail.kind === 'expenses' ? expenses.filter(row => (row.currency || prefs.defaultCurrency) === active.currency) : undefined}
        customers={customers}
        projects={projects}
      />}
    </div>
  )
}
