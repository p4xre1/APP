import { useMemo, useState } from 'react'
import { showAlert, askConfirm } from '../lib/dialogs'
import { errorText, t, useI18n, usePreferences } from '../i18n'
import { money } from '../lib/format'
import { useFatorati } from '../store/useFatorati'
import NumberInput from '../components/NumberInput'
import { BellRing, BellOff, CalendarClock, FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { exportSubscriptionsPdf, exportSubscriptionsXlsx } from '../lib/subscription-export'
import {
  amountToMinor, attentionList, isISODate, MAX_PERIOD_MONTHS, MAX_SERVICE_NAME, MAX_TEXT, minorToAmount,
  subscriptionCategories, subscriptionSummary, subscriptionView, SUBSCRIPTION_CURRENCIES, SUBSCRIPTION_CYCLES,
  validateSubscription, type SubscriptionStatus,
} from '../lib/subscriptions'
import { reminderSettings } from '../lib/notifications'
import type { Subscription, SubscriptionCurrency, SubscriptionCycle } from '../store/types'

type Form = {
  serviceName: string
  category: string
  amount: string
  currency: SubscriptionCurrency
  billingCycle: SubscriptionCycle
  periodMonths: number
  autoRenew: boolean
  startDate: string
  paymentMethod: string
  notes: string
}

const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  active: 'bg-good-50 text-emerald-700',
  expiring_soon: 'bg-warn-50 text-warn',
  expired: 'bg-serious-50 text-serious',
  cancelled: 'bg-canvas text-muted',
}

function emptyForm(defaultCurrency: SubscriptionCurrency): Form {
  return {
    serviceName: '', category: '', amount: '', currency: defaultCurrency,
    billingCycle: 'monthly', periodMonths: 1, autoRenew: true,
    startDate: new Date().toISOString().slice(0, 10), paymentMethod: '', notes: '',
  }
}

function formOf(subscription: Subscription): Form {
  return {
    serviceName: subscription.serviceName,
    category: subscription.category || '',
    amount: String(minorToAmount(subscription.amountMinor, subscription.currency)),
    currency: subscription.currency,
    billingCycle: subscription.billingCycle,
    periodMonths: subscription.periodMonths || 1,
    autoRenew: subscription.autoRenew,
    startDate: subscription.startDate,
    paymentMethod: subscription.paymentMethod || '',
    notes: subscription.notes || '',
  }
}

export function SubscriptionStatusChip({ status, daysLeft }: { status: SubscriptionStatus; daysLeft: number }) {
  const { t: tr } = useI18n()
  const label = status === 'active' && daysLeft >= 0 ? tr('active') : tr(status)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_CLASS[status]}`}>
      {label}{status !== 'cancelled' && status !== 'expired' && daysLeft >= 0 ? ` · ${tr('{count} days left', { count: daysLeft })}` : ''}
    </span>
  )
}

export function SubscriptionSummaryCard({ rows }: { rows: Subscription[] }) {
  const { t: tr, language } = useI18n()
  const totals = useMemo(() => subscriptionSummary(rows), [rows])
  if (!totals.length) return null
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[14px] font-bold text-ink">{tr('Subscription summary')}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {totals.map(total => (
          <div key={total.currency} className="rounded-lg bg-canvas p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{total.currency}</p>
            <p className="mt-1 text-[15px] font-bold text-ink">{money(minorToAmount(total.monthlyMinor, total.currency), total.currency, false, language)} <span className="text-[12px] font-medium text-muted">/ {tr('month')}</span></p>
            <p className="text-[12px] text-muted">{money(minorToAmount(total.yearlyMinor, total.currency), total.currency, false, language)} / {tr('year')}</p>
            <p className="mt-1 text-[11.5px] text-faint">{tr('{count} tracked', { count: total.count })}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-muted">{tr('Currencies are never added together: each one is totalled separately.')}</p>
      <p className="text-[12px] text-muted">{tr('Cancelled and expired entries are not counted.')}</p>
    </div>
  )
}

/** In-app banner: independent of notification permissions and of the OS. */
export function SubscriptionAttentionBanner({ compact, onOpen, rows: given }: { compact?: boolean; onOpen?: () => void; rows?: Subscription[] }) {
  const { t: tr } = useI18n()
  const { subscriptions } = useFatorati()
  const rows = useMemo(() => attentionList(given ?? subscriptions), [given, subscriptions])
  if (!rows.length) return null
  return (
    <div className="rounded-xl border border-warn/40 bg-warn-50 p-4">
      <h2 className="flex items-center gap-2 text-[13.5px] font-bold text-warn">
        <BellRing className="h-4 w-4" />{tr('Subscriptions needing attention')}
      </h2>
      <ul className="mt-2 space-y-1">
        {rows.slice(0, compact ? 3 : rows.length).map(({ subscription, view }) => (
          <li key={subscription.id} className="text-[12.5px] text-ink">
            <span className="font-medium">{subscription.serviceName}</span>{' '}
            <span className="text-muted">
              {view.status === 'expired'
                ? tr('expired on {date}', { date: view.date })
                : tr('{days} days left · {date}', { days: view.daysLeft, date: view.date })}
            </span>
          </li>
        ))}
      </ul>
      {compact && onOpen && (
        <button onClick={onOpen} className="mt-2 text-[12.5px] font-semibold text-brand hover:text-brand-700">{tr('Open subscriptions')}</button>
      )}
      {!compact && rows.length > 3 && <p className="mt-2 text-[12px] text-muted">{tr('{count} entries need attention.', { count: rows.length })}</p>}
      <p className="mt-2 text-[11.5px] text-muted">{tr('This list works without notification permission.')}</p>
    </div>
  )
}

export default function Subscriptions() {
  const { t: tr, language } = useI18n()
  const prefs = usePreferences()
  const { subscriptions, settings, addSubscription, updateSubscription, deleteSubscription } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | SubscriptionStatus>('all')
  const [category, setCategory] = useState('all')
  const defaultCurrency = (SUBSCRIPTION_CURRENCIES as string[]).includes(prefs.defaultCurrency) ? prefs.defaultCurrency as SubscriptionCurrency : 'USD'
  const [form, setForm] = useState<Form>(() => emptyForm(defaultCurrency))
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
  const label = 'block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]'

  const reminders = reminderSettings(settings)
  const categories = useMemo(() => subscriptionCategories(subscriptions), [subscriptions])
  const attention = useMemo(() => attentionList(subscriptions).length, [subscriptions])
  const sorted = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return subscriptions
      .map(subscription => ({ subscription, view: subscriptionView(subscription) }))
      .filter(({ subscription, view }) => {
        if (status !== 'all' && view.status !== status) return false
        if (category !== 'all' && (subscription.category || '') !== category) return false
        if (!needle) return true
        return subscription.serviceName.toLowerCase().includes(needle) || (subscription.category || '').toLowerCase().includes(needle)
      })
      .sort((a, b) => {
        const cancelled = Number(a.view.status === 'cancelled') - Number(b.view.status === 'cancelled')
        if (cancelled !== 0) return cancelled
        if (a.view.daysLeft !== b.view.daysLeft) return a.view.daysLeft - b.view.daysLeft
        return a.subscription.serviceName.localeCompare(b.subscription.serviceName)
      })
  }, [subscriptions, search, status, category])

  function openCreate() { setForm(emptyForm(defaultCurrency)); setEditing(null); setShowForm(true) }
  function openEdit(subscription: Subscription) { setForm(formOf(subscription)); setEditing(subscription); setShowForm(true) }
  function close() { setShowForm(false); setEditing(null) }

  async function save() {
    const amountMinor = amountToMinor(Number(form.amount.replace(',', '.')) || 0, form.currency)
    const periodMonths = form.billingCycle === 'one_time_period' ? Math.min(Math.max(Math.trunc(form.periodMonths) || 1, 1), MAX_PERIOD_MONTHS) : undefined
    const invalid = validateSubscription({ serviceName: form.serviceName, amountMinor, currency: form.currency, startDate: form.startDate, periodMonths })
    if (invalid) { await showAlert(tr(invalid)); return }
    setBusy(true)
    try {
      const payload = {
        serviceName: form.serviceName.trim().slice(0, MAX_SERVICE_NAME),
        category: form.category.trim().slice(0, MAX_TEXT) || undefined,
        amountMinor,
        currency: form.currency,
        billingCycle: form.billingCycle,
        periodMonths,
        autoRenew: form.billingCycle === 'one_time_period' ? false : form.autoRenew,
        startDate: form.startDate,
        paymentMethod: form.paymentMethod.trim().slice(0, MAX_TEXT) || undefined,
        notes: form.notes.trim().slice(0, MAX_TEXT) || undefined,
      }
      if (editing) await updateSubscription(editing.id, payload)
      else await addSubscription({ ...payload, cancelledAt: undefined })
      close()
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function cancelSubscription(subscription: Subscription) {
    const verb = subscription.cancelledAt ? tr('Reactivate') : tr('Cancel subscription')
    if (!await askConfirm(tr('{action} {name}?', { action: verb, name: subscription.serviceName }))) return
    try { await updateSubscription(subscription.id, { cancelledAt: subscription.cancelledAt ? undefined : Date.now() }) }
    catch (error) { await showAlert(errorText(error)) }
  }

  async function remove(subscription: Subscription) {
    if (!await askConfirm(tr('Delete subscription {name}? This cannot be undone.', { name: subscription.serviceName }))) return
    try { await deleteSubscription(subscription.id) } catch (error) { await showAlert(errorText(error)) }
  }

  async function exportAs(kind: 'xlsx' | 'pdf') {
    setBusy(true)
    try {
      if (!subscriptions.length) throw new Error('Nothing to export yet')
      if (kind === 'xlsx') await exportSubscriptionsXlsx(subscriptions, { language })
      else await exportSubscriptionsPdf(subscriptions, { language })
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{tr('Subscriptions')}</h1>
          <p className="mt-1 text-[13px] text-muted">{tr('Track recurring payments • 100% Local • Offline')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={busy} onClick={() => void exportAs('xlsx')} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" />{tr('Excel')}</button>
          <button disabled={busy} onClick={() => void exportAs('pdf')} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"><FileText className="h-4 w-4" />{tr('PDF')}</button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98]"><Plus className="h-4 w-4" />{tr('New subscription')}</button>
        </div>
      </div>

      <p className="text-[12px] text-muted">{tr('Exported files are not encrypted. Delete them when you are done.')}</p>

      {attention > 0 && <SubscriptionAttentionBanner />}

      <SubscriptionSummaryCard rows={subscriptions} />

      {reminders.enabled
        ? <p className="flex items-center gap-1.5 text-[12px] text-muted"><BellRing className="h-3.5 w-3.5" />{tr('Reminders are on: {days} days before, at 09:00.', { days: reminders.warn })}</p>
        : <p className="flex items-center gap-1.5 text-[12px] text-muted"><BellOff className="h-3.5 w-3.5" />{tr('Reminders are off. The banner above still warns you inside the app.')}</p>}

      {showForm && (
        <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-ink">{editing ? tr('Edit subscription') : tr('New subscription')}</h2>
            <button onClick={close} aria-label={tr('Cancel')} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-canvas"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>{tr('Service name')} *</span>
                <input aria-label={tr('Service name')} maxLength={MAX_SERVICE_NAME} value={form.serviceName} onChange={e => setForm({ ...form, serviceName: e.target.value })} className={inputClass} />
              </label>
              <label className="block">
                <span className={label}>{tr('Category')}</span>
                <input aria-label={tr('Category')} list="subscription-categories" maxLength={MAX_TEXT} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass} />
                <datalist id="subscription-categories">{categories.map(value => <option key={value} value={value} />)}</datalist>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={label}>{tr('Amount')} *</span>
                <input aria-label={tr('Amount')} inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputClass} />
              </label>
              <label className="block">
                <span className={label}>{tr('Currency')}</span>
                <select aria-label={tr('Currency')} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value as SubscriptionCurrency })} className={inputClass}>
                  {SUBSCRIPTION_CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={label}>{tr('Billing cycle')}</span>
                <select aria-label={tr('Billing cycle')} value={form.billingCycle} onChange={e => {
                  const billingCycle = e.target.value as SubscriptionCycle
                  setForm({ ...form, billingCycle, autoRenew: billingCycle === 'one_time_period' ? false : form.autoRenew })
                }} className={inputClass}>
                  {SUBSCRIPTION_CYCLES.map(cycle => <option key={cycle} value={cycle}>{tr(cycle)}</option>)}
                </select>
              </label>
            </div>
            {form.billingCycle === 'one_time_period' && (
              <label className="block sm:w-1/3">
                <span className={label}>{tr('Covers how many months?')}</span>
                <NumberInput aria-label={tr('Covers how many months?')} value={form.periodMonths} onChange={periodMonths => setForm({ ...form, periodMonths })} className={inputClass} />
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>{tr('Start date')}</span>
                <input aria-label={tr('Start date')} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inputClass} />
                {!isISODate(form.startDate) && <span className="mt-1 block text-[11.5px] text-serious">{tr('Choose a valid date')}</span>}
              </label>
              <label className="block">
                <span className={label}>{tr('Payment method')}</span>
                <input aria-label={tr('Payment method')} maxLength={MAX_TEXT} value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className={inputClass} />
              </label>
            </div>
            {form.billingCycle !== 'one_time_period' && (
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={form.autoRenew} onChange={e => setForm({ ...form, autoRenew: e.target.checked })} />
                {tr('Renews automatically')}
              </label>
            )}
            <label className="block">
              <span className={label}>{tr('Notes')}</span>
              <textarea aria-label={tr('Notes')} maxLength={MAX_TEXT} rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} />
            </label>
            <p className="text-[12px] text-muted">{tr('Amounts are stored in the smallest unit of the currency, so totals stay exact.')}</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => void save()} className="rounded-lg bg-brand px-6 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-40">{editing ? tr('Save changes') : tr('Save')}</button>
              <button disabled={busy} onClick={close} className="rounded-lg bg-canvas px-6 py-2 text-[13px] text-ink">{tr('Cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {subscriptions.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg bg-canvas px-3 py-2">
              <Search className="h-4 w-4 text-faint" />
              <input type="text" aria-label={tr('Search subscriptions...')} placeholder={tr('Search subscriptions...')} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent text-[13.5px] outline-none" />
            </div>
            <select aria-label={tr('Status')} value={status} onChange={e => setStatus(e.target.value as 'all' | SubscriptionStatus)} className={`${inputClass} w-auto`}>
              <option value="all">{tr('All')}</option>
              {(['active', 'expiring_soon', 'expired', 'cancelled'] as SubscriptionStatus[]).map(value => <option key={value} value={value}>{tr(value)}</option>)}
            </select>
            <select aria-label={tr('Category')} value={category} onChange={e => setCategory(e.target.value)} className={`${inputClass} w-auto`}>
              <option value="all">{tr('All categories')}</option>
              {categories.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {sorted.length === 0 ? (
          <div className="px-5 py-12 text-center">
            {subscriptions.length === 0 ? (
              <>
                <CalendarClock className="mx-auto h-8 w-8 text-faint" />
                <p className="mt-3 text-[13.5px] font-semibold text-ink">{tr('No subscriptions yet')}</p>
                <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted">{tr('Track what leaves your account every month or year: streaming, hosting, insurance, rent, a licence. Fatorati keeps the amounts per currency, warns you before a renewal and exports the list to Excel or PDF. Everything stays on this phone.')}</p>
                <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98]"><Plus className="h-4 w-4" />{tr('New subscription')}</button>
              </>
            ) : <p className="text-[13px] text-muted">{tr('No results')}</p>}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {sorted.map(({ subscription, view }) => (
              <div key={subscription.id} className="p-4 hover:bg-canvas">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink">{subscription.serviceName}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {money(minorToAmount(subscription.amountMinor, subscription.currency), subscription.currency, false, language)} · {tr(subscription.billingCycle)}
                      {subscription.billingCycle === 'one_time_period' && ` · ${tr('{count} months', { count: subscription.periodMonths || 1 })}`}
                      {subscription.category ? ` · ${subscription.category}` : ''}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {subscription.autoRenew && subscription.billingCycle !== 'one_time_period'
                        ? tr('renews on {date}', { date: view.date })
                        : tr('ends on {date}', { date: view.date })}
                    </p>
                    {subscription.paymentMethod && <p className="mt-0.5 text-[12px] text-faint">{subscription.paymentMethod}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <SubscriptionStatusChip status={view.status} daysLeft={view.daysLeft} />
                    <button disabled={busy} onClick={() => openEdit(subscription)} title={tr('Edit')} aria-label={`${tr('Edit')} ${subscription.serviceName}`} className="rounded-lg p-2 hover:bg-canvas"><Pencil className="h-4 w-4 text-muted" /></button>
                    <button disabled={busy} onClick={() => void cancelSubscription(subscription)} className="rounded-lg px-2 py-1 text-[12px] text-muted hover:text-ink">{subscription.cancelledAt ? tr('Reactivate') : tr('Cancel subscription')}</button>
                    <button disabled={busy} onClick={() => void remove(subscription)} title={tr('Delete')} aria-label={`${tr('Delete')} ${subscription.serviceName}`} className="rounded-lg p-2 hover:bg-canvas"><Trash2 className="h-4 w-4 text-serious" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
