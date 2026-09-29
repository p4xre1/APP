import { showAlert } from '../lib/dialogs'
import { errorText } from '../i18n'
import { number } from '../lib/format'
import { useI18n } from '../i18n'
import ExportCsvButton from '../components/ExportCsvButton'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { Plus, Search } from 'lucide-react'
import { Field, TextField, fieldInputClass, fieldLabelClass } from '../components/Field'

export default function Customers() {
  const { t } = useI18n()
  const { customers, addCustomer, deleteCustomer } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<{ name?: string }>({})
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', notes: '' })

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd() {
    try {
      // Required fields must not be empty; empty is a value, not a zero.
      if (!form.name.trim()) { setErrors({ name: 'Required field' }); return }
      setErrors({})
      await addCustomer({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        notes: form.notes.trim(),
        balance: 0,
      })
      setForm({ name: '', email: '', phone: '', address: '', city: '', notes: '' })
      setShowAdd(false)
    } catch (error) { showAlert(errorText(error)) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Customers")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(customers.length)} {t("customers • 100% offline")}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("Add Customer")}</button>
      </div>

      <ExportCsvButton store="customers" />

      <div className="bg-surface rounded-xl border border-line p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <label htmlFor="customer-search" className={fieldLabelClass}>{t('Search customers')}</label>
        <div className="flex items-center gap-2 bg-canvas rounded-lg px-3 py-2 min-h-12">
          <Search className="w-4 h-4 text-faint shrink-0" />
          <input
            id="customer-search"
            type="text"
            inputMode="search"
            placeholder={t("Search customers...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-ink placeholder:text-faint"
          />
        </div>
        <p className="mt-1 text-[12px] text-muted">{t('Search by name or email')}</p>
      </div>

      {showAdd && (
        <div className="bg-surface rounded-xl border border-line p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{t("Add Customer")}</h2>
          <div className="grid grid-cols-1 gap-3.5">
            <TextField label={t('Name')} required value={form.name} error={errors.name || null} onChange={name => setForm({ ...form, name })} placeholder={t('Acme Inc.')} />
            <TextField label={t('Email')} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={email => setForm({ ...form, email })} placeholder={t('owner@business.com')} hint={t('Used on invoices and estimates')} />
            <TextField label={t('Phone')} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={phone => setForm({ ...form, phone })} placeholder={t('Phone example')} hint={t('Shown on shared documents')} />
            <TextField label={t('City')} value={form.city} onChange={city => setForm({ ...form, city })} placeholder={t('New York, NY 10001')} />
            <TextField label={t('Address')} value={form.address} onChange={address => setForm({ ...form, address })} placeholder={t('123 Business St')} />
            <Field label={t('Notes')} hint={t('Optional internal notes')}>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={fieldInputClass} />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-brand text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save")}</button>
            <button onClick={() => { setShowAdd(false); setErrors({}) }} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-[13px]">{t("No customers yet")}</p>
            <p className="text-[12px] text-faint mt-1">{t("Add your first customer to get started")}</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((customer) => (
              <div key={customer.id} className="p-4 flex items-center justify-between gap-3 hover:bg-canvas">
                <div className="min-w-0">
                  <p className="font-medium text-[13px] text-ink break-words">{customer.name}</p>
                  <p className="text-[12px] text-muted mt-0.5 break-words">{[customer.email, customer.phone].filter(Boolean).join(' • ')}</p>
                  {customer.city && <p className="text-[12px] text-muted mt-0.5 break-words">{customer.city}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => deleteCustomer(customer.id)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
