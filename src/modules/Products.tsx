import { showAlert } from '../lib/dialogs'
import { errorText } from '../i18n'
import { number } from '../lib/format'
import { t } from '../i18n'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money } from '../lib/fatorati'
import { Plus } from 'lucide-react'

export default function Products() {
  const { products, addProduct, deleteProduct } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', sku: '', unitPrice: 0, unit: 'piece', stock: 0 })

  async function handleAdd() {
    try {
    if (!form.name.trim()) return
    await addProduct({
      name: form.name.trim(),
      description: form.description.trim(),
      sku: form.sku.trim(),
      unitPrice: form.unitPrice,
      unit: form.unit,
      stock: form.stock,
    })
    setForm({ name: '', description: '', sku: '', unitPrice: 0, unit: 'piece', stock: 0 })
    setShowAdd(false)
    } catch (error) { showAlert(errorText(error)) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Products")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(products.length)} {t("products • 100% offline")}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("Add Product")}</button>
      </div>

      {showAdd && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{t("Add Product")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder={t("Name *")} value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("SKU")} value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input type="number" placeholder={t("Unit Price")} value={form.unitPrice} onChange={e => setForm({...form, unitPrice: parseFloat(e.target.value) || 0})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("Unit")} value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input type="number" placeholder={t("Stock")} value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("Description")} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-brand text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save")}</button>
            <button onClick={() => setShowAdd(false)} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-[13px]">{t("No products yet")}</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {products.map((product) => (
              <div key={product.id} className="p-4 flex items-center justify-between hover:bg-canvas">
                <div>
                  <p className="font-medium text-[13px] text-ink">{product.name} {product.sku && <span className="text-[12px] text-muted">({product.sku})</span>}</p>
                  <p className="text-[12px] text-muted mt-0.5">{product.description}</p>
                  <p className="text-[12px] text-muted mt-0.5">{number(product.stock)} {product.unit} • {money(product.unitPrice)}</p>
                </div>
                <button onClick={() => deleteProduct(product.id)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
