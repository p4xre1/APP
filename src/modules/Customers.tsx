import { showAlert, askConfirm } from '../lib/dialogs'
import { errorText } from '../i18n'
import { number } from '../lib/format'
import { t } from '../i18n'
import ExportCsvButton from '../components/ExportCsvButton'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import type { Customer } from '../store/types'
import { Plus, Search, Pencil } from 'lucide-react'

const empty = { name: '', email: '', phone: '', address: '', city: '', notes: '', taxNumber: '' }

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(empty)
  const inputClass = 'px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search))

  function openCreate() { setForm(empty); setEditing(null); setShowForm(true) }
  function openEdit(customer: Customer) {
    setForm({
      name: customer.name, email: customer.email, phone: customer.phone,
      address: customer.address, city: customer.city, notes: customer.notes,
      taxNumber: customer.taxNumber || '',
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
        taxNumber: form.taxNumber.trim(),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Customers")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(customers.length)} {t("customers • 100% offline")}</p>
        </div>
        <button onClick={openCreate} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("Add Customer")}</button>
      </div>

      <ExportCsvButton store="customers" />

      <div className="bg-surface rounded-xl border border-line p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 bg-canvas rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-faint" />
          <input
            type="text"
            aria-label={t('Search customers...')}
            placeholder={t("Search customers...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[13.5px]"
          />
        </div>
      </div>

      {showForm && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{editing ? t('Edit customer') : t("Add Customer")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Name *")}</span>
              <input aria-label={t('Name *')} placeholder={t("Name *")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Email")}</span>
              <input aria-label={t('Email')} type="email" placeholder={t("Email")} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Phone")}</span>
              <input aria-label={t('Phone')} type="tel" placeholder={t("Phone")} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("City")}</span>
              <input aria-label={t('City')} placeholder={t("City")} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Tax number")}</span>
              <input aria-label={t('Tax number')} placeholder={t("Tax number")} value={form.taxNumber} onChange={e => setForm({ ...form, taxNumber: e.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Address")}</span>
              <input aria-label={t('Address')} placeholder={t("Address")} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputClass + ' w-full'} /></label>
            <label className="block md:col-span-2"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Notes")}</span>
              <textarea aria-label={t('Notes')} placeholder={t("Notes")} rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass + ' w-full'} /></label>
          </div>
          <div className="flex gap-2 mt-4">
            <button disabled={busy} onClick={() => void save()} className="bg-brand text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{editing ? t('Save changes') : t("Save")}</button>
            <button disabled={busy} onClick={() => { setShowForm(false); setEditing(null) }} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-[13px]">{customers.length ? t('No results') : t("No customers yet")}</p>
            {!customers.length && <p className="text-[12px] text-faint mt-1">{t("Add your first customer to get started")}</p>}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((customer) => (
              <div key={customer.id} className="p-4 flex items-center justify-between gap-3 hover:bg-canvas">
                <div className="min-w-0">
                  <p className="font-medium text-[13px] text-ink">{customer.name}</p>
                  <p className="text-[12px] text-muted mt-0.5 truncate">{[customer.email, customer.phone, customer.city].filter(Boolean).join(' • ')}</p>
                  {customer.taxNumber && <p className="text-[12px] text-muted mt-0.5">{t('Tax number')}: {customer.taxNumber}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(customer)} title={t('Edit')} aria-label={`${t('Edit')} ${customer.name}`} className="p-2 hover:bg-canvas rounded-lg"><Pencil className="w-4 h-4 text-muted" /></button>
                  <button onClick={() => void remove(customer)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
