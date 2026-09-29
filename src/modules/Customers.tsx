import { showAlert } from '../lib/dialogs'
import { errorText } from '../i18n'
import { number } from '../lib/format'
import { t } from '../i18n'
import ExportCsvButton from '../components/ExportCsvButton'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { Plus, Search } from 'lucide-react'

export default function Customers() {
  const { customers, addCustomer, deleteCustomer } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', notes: '' })

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd() {
    try {
    if (!form.name.trim()) return
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
        <div className="flex items-center gap-2 bg-canvas rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-faint" />
          <input
            type="text"
            placeholder={t("Search customers...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[13.5px]"
          />
        </div>
      </div>

      {showAdd && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{t("Add Customer")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder={t("Name *")} value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("Email")} value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("Phone")} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("City")} value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("Address")} value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="col-span-2 px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("Notes")} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="col-span-2 px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-brand text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save")}</button>
            <button onClick={() => setShowAdd(false)} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
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
              <div key={customer.id} className="p-4 flex items-center justify-between hover:bg-canvas">
                <div>
                  <p className="font-medium text-[13px] text-ink">{customer.name}</p>
                  <p className="text-[12px] text-muted mt-0.5">{customer.email} • {customer.phone}</p>
                  <p className="text-[12px] text-muted mt-0.5">{customer.city}</p>
                </div>
                <div className="flex items-center gap-2">
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
