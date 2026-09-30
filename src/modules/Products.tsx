import { showAlert, askConfirm } from '../lib/dialogs'
import { errorText } from '../i18n'
import { money, number } from '../lib/format'
import { t, usePreferences } from '../i18n'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import type { Product } from '../store/types'
import NumberInput from '../components/NumberInput'
import { Plus, Search, Pencil } from 'lucide-react'

const empty = { name: '', description: '', sku: '', unitPrice: 0, unit: 'piece', stock: 0 }

export default function Products() {
  const prefs = usePreferences()
  const { products, addProduct, updateProduct, deleteProduct } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(empty)
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  const filtered = products.filter(p => `${p.name} ${p.sku} ${p.description}`.toLowerCase().includes(search.toLowerCase()))

  async function save() {
    if (!form.name.trim()) { await showAlert(t('Enter a name')); return }
    setBusy(true)
    try {
      const payload = { ...form, name: form.name.trim(), description: form.description.trim(), sku: form.sku.trim(), unit: form.unit.trim() || 'piece' }
      if (editing) await updateProduct(editing.id, payload)
      else await addProduct(payload)
      setShowForm(false); setEditing(null); setForm(empty)
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function remove(product: Product) {
    if (!await askConfirm(t('Delete product {name}? This cannot be undone.', { name: product.name }))) return
    try { await deleteProduct(product.id) } catch (error) { await showAlert(errorText(error)) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Products")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(products.length)} {t("products • 100% offline")}</p>
        </div>
        <button onClick={() => { setForm(empty); setEditing(null); setShowForm(true) }} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("Add Product")}</button>
      </div>

      <div className="bg-surface rounded-xl border border-line p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 bg-canvas rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-faint" />
          <input type="text" aria-label={t('Search products...')} placeholder={t('Search products...')} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent outline-none text-[13.5px]" />
        </div>
      </div>

      {showForm && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{editing ? t('Edit product') : t("Add Product")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Name *")}</span>
              <input aria-label={t('Name *')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("SKU")}</span>
              <input aria-label={t('SKU')} value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Unit Price")} ({prefs.defaultCurrency})</span>
              <NumberInput aria-label={t('Unit Price')} value={form.unitPrice} onChange={unitPrice => setForm({ ...form, unitPrice })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Unit")}</span>
              <input aria-label={t('Unit')} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Stock")}</span>
              <NumberInput aria-label={t('Stock')} value={form.stock} onChange={stock => setForm({ ...form, stock })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Description")}</span>
              <input aria-label={t('Description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} /></label>
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
            <p className="text-muted text-[13px]">{products.length ? t('No results') : t("No products yet")}</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((product) => (
              <div key={product.id} className="p-4 flex items-center justify-between gap-3 hover:bg-canvas">
                <div className="min-w-0">
                  <p className="font-medium text-[13px] text-ink">{product.name} {product.sku && <span className="text-[12px] text-muted">({product.sku})</span>}</p>
                  {product.description && <p className="text-[12px] text-muted mt-0.5 truncate">{product.description}</p>}
                  <p className="text-[12px] text-muted mt-0.5">{number(product.stock)} {product.unit} • {money(product.unitPrice, prefs.defaultCurrency)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setForm({ ...empty, ...product, description: product.description || '', sku: product.sku || '', unit: product.unit || 'piece' }); setEditing(product); setShowForm(true) }} title={t('Edit')} aria-label={`${t('Edit')} ${product.name}`} className="p-2 hover:bg-canvas rounded-lg"><Pencil className="w-4 h-4 text-muted" /></button>
                  <button onClick={() => void remove(product)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
