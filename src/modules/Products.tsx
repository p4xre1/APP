import { showAlert } from '../lib/dialogs'
import { errorText, useI18n } from '../i18n'
import { number } from '../lib/format'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money } from '../lib/fatorati'
import { Plus } from 'lucide-react'
import NumberInput from '../components/NumberInput'
import { TextField } from '../components/Field'
import { getPreferences } from '../lib/preferences'

export default function Products() {
  const { t } = useI18n()
  const { products, addProduct, deleteProduct } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [errors, setErrors] = useState<{ name?: string }>({})
  const [form, setForm] = useState({ name: '', description: '', sku: '', unitPrice: null as number | null, unit: 'piece', stock: null as number | null })
  const currency = getPreferences().defaultCurrency

  async function handleAdd() {
    try {
      if (!form.name.trim()) { setErrors({ name: 'Required field' }); return }
      setErrors({})
      await addProduct({
        name: form.name.trim(),
        description: form.description.trim(),
        sku: form.sku.trim(),
        unitPrice: form.unitPrice ?? 0,
        unit: form.unit,
        stock: form.stock ?? 0,
      })
      setForm({ name: '', description: '', sku: '', unitPrice: null, unit: 'piece', stock: null })
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
        <div className="bg-surface rounded-xl border border-line p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{t("Add Product")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TextField label={t('Name')} required value={form.name} error={errors.name} onChange={name => setForm({...form, name})} placeholder={t('Acme Inc.')} />
            <TextField label={t('SKU')} value={form.sku} onChange={sku => setForm({...form, sku})} hint={t('Optional internal code')} placeholder={t('SKU-001')} />
            <NumberInput label={t('Unit price')} value={form.unitPrice} min={0} suffix={currency} hint={`${t('Unit price')} (${currency})`} onChange={unitPrice => setForm({...form, unitPrice})} />
            <NumberInput label={t('Stock')} value={form.stock} min={0} integer hint={t('Whole numbers only')} onChange={stock => setForm({...form, stock})} />
            <TextField label={t('Unit')} value={form.unit} onChange={unit => setForm({...form, unit})} hint={t('Piece, hour, kg...')} placeholder={t('piece')} />
            <TextField label={t('Description')} value={form.description} onChange={description => setForm({...form, description})} hint={t('Optional description')} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-brand text-white px-3.5 py-2.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save")}</button>
            <button onClick={() => { setShowAdd(false); setErrors({}) }} className="bg-canvas text-ink px-4 py-2.5 rounded-lg text-[13px]">{t("Cancel")}</button>
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
              <div key={product.id} className="p-4 flex items-center justify-between gap-3 hover:bg-canvas">
                <div className="min-w-0">
                  <p className="font-medium text-[13px] text-ink break-words">{product.name} {product.sku && <span className="text-[12px] text-muted">({product.sku})</span>}</p>
                  <p className="text-[12px] text-muted mt-0.5 break-words">{product.description}</p>
                  <p className="text-[12px] text-muted mt-0.5">{number(product.stock)} {product.unit} • {money(product.unitPrice, currency)}</p>
                </div>
                <button onClick={() => deleteProduct(product.id)} className="text-[12px] text-serious px-2 py-1 shrink-0">{t("Delete")}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
