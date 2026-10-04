import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Users, Wallet, Trophy, MapPin, List } from 'lucide-react'
import { showAlert, askConfirm } from '../lib/dialogs'
import { errorText, usePreferences } from '../i18n'
import { money, number } from '../lib/format'
import { t } from '../i18n'
import { todayISO } from '../lib/subscriptions'
import { customerInsights, type CustomerInsight } from '../lib/customer-insights'
import { customerLocationCategory, customerLocationKey, MOROCCAN_CITIES, US_STATES, usStateName, usStateCode } from '../lib/customer-location'
import ExportCsvButton from '../components/ExportCsvButton'
import CustomerMap from '../components/CustomerMap'
import { useFatorati } from '../store/useFatorati'
import type { Customer } from '../store/types'

type CustomerCountry = NonNullable<Customer['country']>
type CustomerForm = {
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  country: CustomerCountry | ''
  countryName: string
  notes: string
  taxNumber: string
  kind: 'business' | 'individual'
}

const empty: CustomerForm = {
  name: '', email: '', phone: '', address: '', city: '', state: '', country: '', countryName: '',
  notes: '', taxNumber: '', kind: 'business',
}
const inputClass = 'px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

type Translate = typeof t


function locationDetail(customer: Customer, tr: Translate): string {
  if (customer.country === 'MA') return [tr('Morocco'), customer.city.trim()].filter(Boolean).join(' · ')
  if (customer.country === 'US') return [tr('United States'), customer.state ? tr(usStateName(customer.state)) : '', customer.city.trim()].filter(Boolean).join(' · ')
  if (customer.country === 'other') return [customer.countryName?.trim(), customer.city.trim()].filter(Boolean).join(' · ') || tr('Location not set')
  return customer.city.trim() || tr('Location not set')
}

function amountsLabel(rows: CustomerInsight['received'], emptyLabel: string, language: ReturnType<typeof usePreferences>['language']): string {
  const values = rows.filter(row => row.amount !== 0)
  return values.length ? values.map(row => money(row.amount, row.currency, false, language)).join(' · ') : emptyLabel
}

export default function Customers() {
  const { customers, invoices, addCustomer, updateCustomer, deleteCustomer } = useFatorati()
  const prefs = usePreferences()
  const today = todayISO()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [sortBy, setSortBy] = useState('rank')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CustomerForm>(empty)

  const insights = useMemo(
    () => customerInsights(customers, invoices, prefs.defaultCurrency, today),
    [customers, invoices, prefs.defaultCurrency, today],
  )
  const insightFor = (customer: Customer) => insights.get(customer.id)!
  const withOutstanding = (customer: Customer) => insightFor(customer).outstanding.some(row => row.amount > 0)
  const owingCount = customers.filter(withOutstanding).length
  const topCustomer = customers
    .filter(customer => insightFor(customer).rank === 1)
    .sort((a, b) => a.name.localeCompare(b.name))[0]

  const locationOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const customer of customers) {
      const key = customerLocationKey(customer)
      if (!options.has(key)) options.set(key, customerLocationCategory(customer, t))
    }
    return [...options].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [customers, prefs.language])

  const filtered = customers.filter(customer => {
    const searchText = [
      customer.name, customer.email, customer.phone, customer.address, customer.city, customer.state,
      customer.countryName, customer.taxNumber, customer.notes,
      customer.country === 'MA' ? t('Morocco') : '',
      customer.country === 'US' ? t('United States') : '',
      customer.state ? usStateName(customer.state) : '',
    ].filter(Boolean).join(' ').toLocaleLowerCase()
    if (search && !searchText.includes(search.toLocaleLowerCase())) return false
    if (locationFilter !== 'all' && customerLocationKey(customer) !== locationFilter) return false
    if (kindFilter !== 'all' && (customer.kind || 'business') !== kindFilter) return false
    const owes = withOutstanding(customer)
    if (paymentFilter === 'outstanding' && !owes) return false
    if (paymentFilter === 'settled' && owes) return false
    return true
  }).sort((a, b) => {
    const left = insightFor(a), right = insightFor(b)
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'newest') return b.createdAt - a.createdAt
    if (sortBy === 'owed') {
      if (left.outstandingValue === null && right.outstandingValue !== null) return 1
      if (right.outstandingValue === null && left.outstandingValue !== null) return -1
      return (right.outstandingValue || 0) - (left.outstandingValue || 0) || a.name.localeCompare(b.name)
    }
    if (left.rank !== null && right.rank !== null && left.rank !== right.rank) return left.rank - right.rank
    if (left.rank !== null && right.rank === null) return -1
    if (right.rank !== null && left.rank === null) return 1
    if (left.rankValue !== null && right.rankValue !== null && left.rankValue !== right.rankValue) return right.rankValue - left.rankValue
    return b.createdAt - a.createdAt || a.name.localeCompare(b.name)
  })

  function openCreate() { setForm(empty); setEditing(null); setShowForm(true) }
  function openEdit(customer: Customer) {
    setForm({
      name: customer.name, email: customer.email, phone: customer.phone,
      address: customer.address, city: customer.city, state: customer.state ? usStateCode(customer.state) || customer.state : '',
      country: customer.country || '', countryName: customer.countryName || '',
      notes: customer.notes, taxNumber: customer.taxNumber || '',
      kind: customer.kind || 'business',
    })
    setEditing(customer); setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { await showAlert(t('Enter a name')); return }
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
        address: form.address.trim(), city: form.city.trim(), notes: form.notes.trim(),
        taxNumber: form.taxNumber.trim(), kind: form.kind,
        country: form.country || undefined,
        countryName: form.country === 'other' ? (form.countryName.trim() || undefined) : undefined,
        state: form.country === 'US' ? (form.state || undefined) : undefined,
      }
      if (editing) await updateCustomer(editing.id, payload)
      else await addCustomer({ ...payload, balance: 0 })
      setShowForm(false); setEditing(null)
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function remove(customer: Customer) {
    if (!await askConfirm(t('Delete customer {name}? This cannot be undone.', { name: customer.name }))) return
    try { await deleteCustomer(customer.id) } catch (error) { await showAlert(errorText(error)) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Customers')}</h1>
          <p className="text-[13px] text-muted mt-1">{number(customers.length)} {t('customers • 100% offline')}</p>
        </div>
        <button onClick={openCreate} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t('Add Customer')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-muted"><Users className="h-4 w-4 text-brand" />{t('Total customers')}</div>
          <p className="mt-2 text-[22px] font-bold tnum">{number(customers.length)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-muted"><Wallet className="h-4 w-4 text-warn" />{t('Clients with unpaid balances')}</div>
          <p className="mt-2 text-[22px] font-bold tnum">{number(owingCount)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-muted"><Trophy className="h-4 w-4 text-brand" />{t('Top client')}</div>
          {topCustomer ? <div className="mt-2 min-w-0"><p className="truncate text-[15px] font-bold">{topCustomer.name}</p><p className="mt-0.5 text-[12px] text-muted tnum">{money(insightFor(topCustomer).rankValue || 0, prefs.defaultCurrency, false, prefs.language)}</p></div> : <p className="mt-2 text-[13px] text-muted">{t('No paid invoices yet')}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-muted">
        <p className="flex items-center gap-1.5 font-semibold text-ink"><Trophy className="h-3.5 w-3.5 text-brand" />{t('Ranked by amount paid in {currency}', { currency: prefs.defaultCurrency })}</p>
        <p className="mt-1">{t('Foreign-currency payments need a saved exchange rate to be included in the rank.')}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <ExportCsvButton store="customers" />
        <div className="flex rounded-lg border border-line bg-canvas p-1">
          <button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition-colors ${viewMode === 'list' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
            <List className="h-4 w-4" />{t('List view')}
          </button>
          <button type="button" aria-pressed={viewMode === 'map'} onClick={() => { setLocationFilter('all'); setViewMode('map') }} className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition-colors ${viewMode === 'map' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
            <MapPin className="h-4 w-4" />{t('Map view')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(150px,1fr))]">
          <label className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-faint" />
            <input type="text" aria-label={t('Search customers...')} placeholder={t('Search customers...')} value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
          </label>
          <select aria-label={t('Filter by location')} value={locationFilter} onChange={event => setLocationFilter(event.target.value)} className={inputClass}>
            <option value="all">{t('All locations')}</option>
            {locationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select aria-label={t('Customer type')} value={kindFilter} onChange={event => setKindFilter(event.target.value)} className={inputClass}>
            <option value="all">{t('All client types')}</option>
            <option value="business">{t('Business')}</option>
            <option value="individual">{t('Individual')}</option>
          </select>
          <div className="flex gap-2">
            <select aria-label={t('Payment status filter')} value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)} className={inputClass + ' min-w-0 flex-1'}>
              <option value="all">{t('All payment statuses')}</option>
              <option value="outstanding">{t('Has unpaid balance')}</option>
              <option value="settled">{t('No unpaid balance')}</option>
            </select>
            <select aria-label={t('Sort by')} value={sortBy} onChange={event => setSortBy(event.target.value)} className={inputClass + ' min-w-0 flex-1'}>
              <option value="rank">{t('Top paid')}</option>
              <option value="owed">{t('Highest unpaid')}</option>
              <option value="name">{t('Name A–Z')}</option>
              <option value="newest">{t('Newest first')}</option>
            </select>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="mb-4 font-semibold text-ink">{editing ? t('Edit customer') : t('Add Customer')}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Name *')}</span>
              <input aria-label={t('Name *')} placeholder={t('Name *')} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Email')}</span>
              <input aria-label={t('Email')} type="email" placeholder={t('Email')} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Phone')}</span>
              <input aria-label={t('Phone')} type="tel" placeholder={t('Phone')} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Country')}</span>
              <select aria-label={t('Country')} value={form.country} onChange={event => {
                const country = event.target.value as CustomerCountry | ''
                setForm({ ...form, country, state: country === 'US' ? form.state : '', countryName: country === 'other' ? form.countryName : '' })
              }} className={inputClass + ' w-full'}>
                <option value="">{t('Select a country')}</option>
                <option value="MA">{t('Morocco')}</option>
                <option value="US">{t('United States')}</option>
                <option value="other">{t('Other')}</option>
              </select></label>
            {form.country === 'US' && <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('State')}</span>
              <select aria-label={t('State')} value={form.state} onChange={event => setForm({ ...form, state: event.target.value })} className={inputClass + ' w-full'}>
                <option value="">{t('Select a state')}</option>
                {US_STATES.map(([code, name]) => <option key={code} value={code}>{t(name)} ({code})</option>)}
              </select></label>}
            {form.country === 'other' && <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Country name')}</span>
              <input aria-label={t('Country name')} placeholder={t('Country name')} value={form.countryName} onChange={event => setForm({ ...form, countryName: event.target.value })} className={inputClass + ' w-full'} /></label>}
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{form.country === 'MA' ? t('City in Morocco') : t('City')}</span>
              <input aria-label={form.country === 'MA' ? t('City in Morocco') : t('City')} placeholder={form.country === 'MA' ? t('City in Morocco') : t('City')} list={form.country === 'MA' ? 'morocco-city-options' : undefined} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} className={inputClass + ' w-full'} />
              {form.country === 'MA' && <datalist id="morocco-city-options">{MOROCCAN_CITIES.map(city => <option key={city} value={city} />)}</datalist>}</label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Customer type')}</span>
              <select aria-label={t('Customer type')} value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as 'business' | 'individual' })} className={inputClass + ' w-full'}>
                <option value="business">{t('Business')}</option>
                <option value="individual">{t('Individual')}</option>
              </select></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Tax number')}</span>
              <input aria-label={t('Tax number')} placeholder={t('Tax number')} value={form.taxNumber} onChange={event => setForm({ ...form, taxNumber: event.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block md:col-span-2"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Address')}</span>
              <input aria-label={t('Address')} placeholder={t('Address')} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block md:col-span-2"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Notes')}</span>
              <textarea aria-label={t('Notes')} placeholder={t('Notes')} rows={2} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className={inputClass + ' w-full'} /></label>
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={() => void save()} className="bg-brand px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-40">{editing ? t('Save changes') : t('Save')}</button>
            <button disabled={busy} onClick={() => { setShowForm(false); setEditing(null) }} className="rounded-lg bg-canvas px-4 py-2 text-[13px] text-ink">{t('Cancel')}</button>
          </div>
        </div>
      )}

      {viewMode === 'map' ? <CustomerMap customers={filtered} onSelectLocation={key => { setLocationFilter(key); setViewMode('list') }} /> : <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-muted">{customers.length ? t('No customers match these filters') : t('No customers yet')}</p>
            {!customers.length && <p className="mt-1 text-[12px] text-faint">{t('Add your first customer to get started')}</p>}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map(customer => {
              const insight = insightFor(customer)
              const hasBalance = insight.outstanding.some(row => row.amount > 0)
              return <div key={customer.id} className="p-4 transition-colors hover:bg-canvas/70">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {insight.rank !== null && <span aria-label={`${t('Rank')} ${number(insight.rank)}`} title={`${t('Rank')} ${number(insight.rank)}`} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700"><Trophy className="h-3 w-3" />#{number(insight.rank)}</span>}
                      <p className="truncate text-[14px] font-semibold text-ink">{customer.name}</p>
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-muted">{customer.kind === 'individual' ? t('Individual') : t('Business')}</span>
                      {hasBalance && <span className="rounded-full bg-warn-50 px-2 py-0.5 text-[10px] font-semibold text-warn">{t('Has unpaid balance')}</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                      {customer.email && <span className="truncate">{customer.email}</span>}
                      {customer.phone && <span>{customer.phone}</span>}
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{locationDetail(customer, t)}</span>
                    </div>
                    {customer.taxNumber && <p className="mt-1 text-[12px] text-muted">{t('Tax number')}: {customer.taxNumber}</p>}
                    {customer.address && <p className="mt-1 truncate text-[12px] text-muted">{t('Address')}: {customer.address}</p>}
                    {customer.notes && <p className="mt-1 line-clamp-2 text-[12px] text-muted">{customer.notes}</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[420px] xl:max-w-[540px] xl:flex-1">
                    <div className="rounded-lg bg-canvas px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('Total invoiced')}</p>
                      <p className="mt-1 break-words text-[12px] font-semibold text-ink tnum">{amountsLabel(insight.invoiced, t('No invoices yet'), prefs.language)}</p>
                    </div>
                    <div className="rounded-lg bg-canvas px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('Amount paid')}</p>
                      <p className="mt-1 break-words text-[12px] font-semibold text-ink tnum">{amountsLabel(insight.received, t('No payments recorded'), prefs.language)}</p>
                    </div>
                    <div className={`rounded-lg px-3 py-2 ${hasBalance ? 'bg-warn-50' : 'bg-canvas'}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${hasBalance ? 'text-warn' : 'text-muted'}`}>{t('Unpaid balance')}</p>
                      <p className={`mt-1 break-words text-[12px] font-semibold tnum ${hasBalance ? 'text-warn' : 'text-ink'}`}>{amountsLabel(insight.outstanding, t('No open balance'), prefs.language)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-1 xl:ms-1">
                    <button onClick={() => openEdit(customer)} title={t('Edit')} aria-label={`${t('Edit')} ${customer.name}`} className="rounded-lg p-2 hover:bg-canvas"><Pencil className="h-4 w-4 text-muted" /></button>
                    <button onClick={() => void remove(customer)} className="px-2 py-1 text-[12px] text-serious hover:text-serious">{t('Delete')}</button>
                  </div>
                </div>
              </div>
            })}
          </div>
        )}
      </div>}
    </div>
  )
}
