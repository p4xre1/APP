import { useFatorati } from '../store/useFatorati'
import { money, number } from '../lib/format'
import { reportTotals } from '../lib/reports'
import { useI18n, usePreferences } from '../i18n'
import { Fragment } from 'react'

export default function Reports() {
  const { invoices, expenses, customers } = useFatorati()

  const { t } = useI18n(), prefs = usePreferences()
  const result = reportTotals(invoices, expenses, prefs.defaultCurrency)
  const rows = result.totals.length ? result.totals : [{currency:prefs.defaultCurrency,revenue:0,pending:0,expenses:0,profit:0}]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Reports')}</h1>
        <p className="text-[13px] text-muted mt-1">{t('Business reports • 100% offline')}</p>
      </div>

      {rows.map(row => {
        const { currency, revenue:totalRevenue, pending:pendingRevenue, expenses:totalExpenses, profit } = row
        const currencyInvoices = invoices.filter(inv => (inv.currency || prefs.defaultCurrency) === currency)
        const currencyExpenses = expenses.filter(exp => (exp.currency || prefs.defaultCurrency) === currency)
        return <Fragment key={currency}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-5 rounded-xl border border-line shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[13px] text-muted">{t('Total Revenue (Paid)')}</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{money(totalRevenue,currency)}</p>
          <p className="text-[12px] text-muted mt-1">{number(currencyInvoices.filter(inv => inv.status === 'paid').length)} {t('invoices')}</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-line shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[13px] text-muted">{t('Pending Revenue')}</p>
          <p className="text-2xl font-bold text-brand mt-1">{money(pendingRevenue,currency)}</p>
          <p className="text-[12px] text-muted mt-1">{number(currencyInvoices.filter(inv => inv.status === 'sent').length)} {t('sent')}</p>
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
    </div>
  )
}
