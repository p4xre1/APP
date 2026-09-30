import { showAlert, askConfirm } from '../lib/dialogs'
import { errorText } from '../i18n'
import { money, number } from '../lib/format'
import { t, usePreferences } from '../i18n'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import type { Product, ProductType, BundleComponent, ProductAttribute } from '../store/types'
import {
  PRODUCT_TYPES, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_HINT, PRODUCT_OPTION_LABEL,
  SERVICE_BILLING_METHODS, LABOR_BILLING_UNITS, BILLING_FREQUENCIES, RENEWAL_BEHAVIORS,
  DIGITAL_FORMATS, DURATION_UNITS, productType, tracksInventory, isLowStock, matchesProduct, validateProduct,
} from '../lib/products'
import NumberInput from '../components/NumberInput'
import { Plus, Search, Pencil } from 'lucide-react'

/**
 * One flat form: every field of every type lives here at once, so switching
 * the type never erases what was already entered (dormant values are saved
 * with the product and come back when the type is switched back).
 */
const empty = {
  type: 'physical' as ProductType,
  name: '', description: '', sku: '', category: '',
  unitPrice: 0, costPrice: 0, unit: 'piece',
  trackInventory: true, stock: 0, minStock: 0, reorderQty: 0, maxStock: 0, location: '',
  barcode: '', brand: '', manufacturer: '', model: '', vendor: '', supplierSku: '',
  weight: 0, weightUnit: 'kg', length: 0, width: 0, height: 0, dimensionUnit: 'cm',
  billingMethod: '', duration: 0, durationUnit: 'hours',
  billingFrequency: '', renewal: '',
  fileFormat: '', fileRef: '', fileUrl: '', version: '', licenseType: '', deliveryMethod: '',
  internalNotes: '',
  components: [] as BundleComponent[],
  attributes: [] as ProductAttribute[],
}
type ProductForm = typeof empty

function formFromProduct(product: Product): ProductForm {
  return {
    type: productType(product),
    name: product.name, description: product.description || '', sku: product.sku || '', category: product.category || '',
    unitPrice: product.unitPrice, costPrice: product.costPrice ?? 0, unit: product.unit || 'piece',
    trackInventory: product.trackInventory !== false, stock: product.stock, minStock: product.minStock ?? 0,
    reorderQty: product.reorderQty ?? 0, maxStock: product.maxStock ?? 0, location: product.location || '',
    barcode: product.barcode || '', brand: product.brand || '', manufacturer: product.manufacturer || '',
    model: product.model || '', vendor: product.vendor || '', supplierSku: product.supplierSku || '',
    weight: product.weight ?? 0, weightUnit: product.weightUnit || 'kg',
    length: product.length ?? 0, width: product.width ?? 0, height: product.height ?? 0,
    dimensionUnit: product.dimensionUnit || 'cm',
    billingMethod: product.billingMethod || '', duration: product.duration ?? 0, durationUnit: product.durationUnit || 'hours',
    billingFrequency: product.billingFrequency || '', renewal: product.renewal || '',
    fileFormat: product.fileFormat || '', fileRef: product.fileRef || '', fileUrl: product.fileUrl || '',
    version: product.version || '', licenseType: product.licenseType || '', deliveryMethod: product.deliveryMethod || '',
    internalNotes: product.internalNotes || '',
    components: (product.components ?? []).map(component => ({ ...component })),
    attributes: (product.attributes ?? []).map(attribute => ({ ...attribute })),
  }
}

export default function Products() {
  const prefs = usePreferences()
  const { products, addProduct, updateProduct, deleteProduct } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | ProductType>('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<ProductForm>(empty)
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
  const labelClass = 'block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]'
  const sectionClass = 'text-[12px] font-bold text-ink uppercase tracking-[0.08em] mt-2'

  const filtered = products.filter(product =>
    (!typeFilter || productType(product) === typeFilter) && matchesProduct(product, search))
  const kind = form.type
  const isPhysical = kind === 'physical'
  const isLabor = kind === 'labor'

  async function save() {
    setBusy(true)
    try {
      const optional = (value: string) => value.trim() || undefined
      const amount = (value: number) => (value || undefined)
      const attributes = form.attributes.filter(attribute => attribute.name.trim() || attribute.value.trim())
      const problem = validateProduct({
        name: form.name, type: form.type, unitPrice: form.unitPrice, costPrice: amount(form.costPrice),
        stock: form.stock, minStock: amount(form.minStock), reorderQty: amount(form.reorderQty), maxStock: amount(form.maxStock),
        weight: amount(form.weight), length: amount(form.length), width: amount(form.width), height: amount(form.height),
        duration: amount(form.duration),
        components: kind === 'bundle' ? form.components : undefined,
        attributes,
      })
      if (problem) { await showAlert(t(problem)); return }
      const payload = {
        type: form.type,
        name: form.name.trim(), description: form.description.trim(), sku: form.sku.trim(),
        category: optional(form.category),
        unitPrice: form.unitPrice, costPrice: amount(form.costPrice),
        unit: isLabor ? (form.billingMethod || 'hour') : (form.unit.trim() || 'piece'),
        // Dormant inventory values are saved as-is so switching the type back never loses them.
        trackInventory: form.trackInventory ? undefined : false,
        stock: form.stock, minStock: amount(form.minStock),
        reorderQty: amount(form.reorderQty), maxStock: amount(form.maxStock), location: optional(form.location),
        barcode: optional(form.barcode), brand: optional(form.brand), manufacturer: optional(form.manufacturer),
        model: optional(form.model), vendor: optional(form.vendor), supplierSku: optional(form.supplierSku),
        weight: amount(form.weight), weightUnit: form.weight ? form.weightUnit : undefined,
        length: amount(form.length), width: amount(form.width), height: amount(form.height),
        dimensionUnit: form.length || form.width || form.height ? form.dimensionUnit : undefined,
        billingMethod: optional(form.billingMethod), duration: amount(form.duration),
        durationUnit: form.duration ? form.durationUnit : undefined,
        billingFrequency: optional(form.billingFrequency), renewal: optional(form.renewal),
        fileFormat: optional(form.fileFormat), fileRef: optional(form.fileRef), fileUrl: optional(form.fileUrl),
        version: optional(form.version), licenseType: optional(form.licenseType), deliveryMethod: optional(form.deliveryMethod),
        internalNotes: optional(form.internalNotes),
        components: form.components.length
          ? form.components.map(component => ({ ...component, name: component.name.trim(), note: component.note?.trim() || undefined }))
          : undefined,
        attributes: attributes.length ? attributes.map(attribute => ({ name: attribute.name.trim(), value: attribute.value.trim() })) : undefined,
      }
      if (editing) await updateProduct(editing.id, payload)
      else await addProduct(payload)
      setShowForm(false); setEditing(null); setForm(empty)
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function remove(product: Product) {
    if (!await askConfirm(t('Delete product {name}? This cannot be undone.', { name: product.name }))) return
    try { await deleteProduct(product.id) } catch (error) { await showAlert(errorText(error)) }
  }

  const textField = (label: string, key: keyof ProductForm, span?: string) => (
    <label className={`block ${span || ''}`}><span className={labelClass}>{t(label)}</span>
      <input aria-label={t(label)} value={form[key] as string} onChange={e => setForm({ ...form, [key]: e.target.value })} className={inputClass} /></label>
  )
  const numberField = (label: string, key: keyof ProductForm, suffix?: string) => (
    <label className="block"><span className={labelClass}>{t(label)}{suffix ? ` (${suffix})` : ''}</span>
      <NumberInput aria-label={t(label)} value={form[key] as number} onChange={value => setForm({ ...form, [key]: value })} className={inputClass} /></label>
  )
  const selectField = (label: string, key: keyof ProductForm, options: readonly string[], allowEmpty = true) => (
    <label className="block"><span className={labelClass}>{t(label)}</span>
      <select aria-label={t(label)} value={form[key] as string} onChange={e => setForm({ ...form, [key]: e.target.value })} className={inputClass}>
        {allowEmpty && <option value="">—</option>}
        {options.map(option => <option key={option} value={option}>{t(PRODUCT_OPTION_LABEL[option] || option)}</option>)}
      </select></label>
  )

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
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex flex-1 items-center gap-2 bg-canvas rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-faint" />
            <input type="text" aria-label={t('Search products...')} placeholder={t('Search products...')} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent outline-none text-[13.5px]" />
          </div>
          <select aria-label={t('Filter by type')} value={typeFilter} onChange={e => setTypeFilter(e.target.value as '' | ProductType)} className="bg-canvas rounded-lg px-3 py-2 text-[13.5px] outline-none border border-transparent focus:border-brand">
            <option value="">{t('All types')}</option>
            {PRODUCT_TYPES.map(value => <option key={value} value={value}>{t(PRODUCT_TYPE_LABEL[value])}</option>)}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-5">
          <h2 className="font-semibold text-ink">{editing ? t('Edit product') : t("Add Product")}</h2>

          {/* Step 1 — type. Switching keeps every value already entered. */}
          <fieldset>
            <legend className={sectionClass}>{t('Product type')}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {PRODUCT_TYPES.map(value => (
                <label key={value} className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${kind === value ? 'border-brand ring-2 ring-brand/15' : 'border-line hover:border-line-strong'}`}>
                  <input type="radio" name="product-type" value={value} checked={kind === value} onChange={() => setForm({ ...form, type: value })} className="mt-1 accent-current text-brand" />
                  <span>
                    <span className="block text-[13px] font-semibold text-ink">{t(PRODUCT_TYPE_LABEL[value])}</span>
                    <span className="block text-[11.5px] text-muted mt-0.5">{t(PRODUCT_TYPE_HINT[value])}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11.5px] text-muted mt-2">{t('Fields update to match the type. Values you entered before switching are kept.')}</p>
          </fieldset>

          {/* Step 2 — basic information */}
          <div>
            <h3 className={sectionClass}>{t('Basic information')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <label className="block"><span className={labelClass}>{t("Name *")}</span>
                <input aria-label={t('Name *')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
              {textField('SKU', 'sku')}
              {textField('Category', 'category')}
              {textField('Description', 'description')}
            </div>
          </div>

          {/* Step 3 — pricing (existing single-currency, single-tax-rate architecture) */}
          <div>
            <h3 className={sectionClass}>{t('Pricing')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {numberField(isLabor ? 'Hourly rate *' : 'Selling price *', 'unitPrice', prefs.defaultCurrency)}
              {numberField(isLabor ? 'Cost per hour' : 'Cost price', 'costPrice', prefs.defaultCurrency)}
              {!isLabor && textField('Unit', 'unit')}
            </div>
          </div>

          {/* Step 4 — type-specific section */}
          {isPhysical && (
            <div>
              <h3 className={sectionClass}>{t('Inventory')}</h3>
              <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={form.trackInventory} onChange={e => setForm({ ...form, trackInventory: e.target.checked })} className="accent-current text-brand" />
                {t('Track inventory')}
              </label>
              <p className="text-[11.5px] text-muted mt-1">{t('Stock stays a figure you maintain yourself — invoices never change it.')}</p>
              {form.trackInventory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  {numberField('Stock', 'stock')}
                  {numberField('Low-stock alert level', 'minStock')}
                  {numberField('Reorder quantity', 'reorderQty')}
                  {numberField('Maximum stock', 'maxStock')}
                  {textField('Warehouse / location', 'location')}
                </div>
              )}
            </div>
          )}
          {(kind === 'service' || isLabor) && (
            <div>
              <h3 className={sectionClass}>{isLabor ? t('Labor billing') : t('Service billing')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {isLabor
                  ? selectField('Billing unit', 'billingMethod', LABOR_BILLING_UNITS)
                  : selectField('Billing method', 'billingMethod', SERVICE_BILLING_METHODS)}
                {numberField(isLabor ? 'Estimated hours' : 'Estimated duration', 'duration')}
                {!isLabor && selectField('Duration unit', 'durationUnit', DURATION_UNITS, false)}
              </div>
            </div>
          )}
          {kind === 'digital' && (
            <div>
              <h3 className={sectionClass}>{t('Digital delivery')}</h3>
              <p className="text-[11.5px] text-muted mt-1">{t('Reference only — the app stays offline and never uploads or downloads files.')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {selectField('Product format', 'fileFormat', DIGITAL_FORMATS)}
                {textField('File name or reference', 'fileRef')}
                {textField('Reference URL', 'fileUrl')}
                {textField('Version', 'version')}
                {textField('License type', 'licenseType')}
                {textField('Delivery method', 'deliveryMethod')}
              </div>
            </div>
          )}
          {kind === 'recurring_service' && (
            <div>
              <h3 className={sectionClass}>{t('Recurring billing')}</h3>
              <p className="text-[11.5px] text-muted mt-1">{t('Describes a service you sell repeatedly. It does not schedule or create invoices.')}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {selectField('Billing frequency', 'billingFrequency', BILLING_FREQUENCIES)}
                {selectField('Renewal behavior', 'renewal', RENEWAL_BEHAVIORS)}
                {numberField('Service duration', 'duration')}
                {selectField('Duration unit', 'durationUnit', DURATION_UNITS, false)}
              </div>
            </div>
          )}
          {kind === 'bundle' && (
            <div>
              <h3 className={sectionClass}>{t('Bundle components')}</h3>
              <p className="text-[11.5px] text-muted mt-1">{t('Components reference your existing products. The selling price is what you charge for the whole package.')}</p>
              <div className="space-y-2 mt-2">
                {form.components.map((component, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <select aria-label={t('Component product')} value={component.productId || ''} onChange={e => {
                      const chosen = products.find(candidate => candidate.id === e.target.value)
                      const components = [...form.components]
                      components[index] = { ...component, productId: chosen?.id, name: chosen?.name || component.name }
                      setForm({ ...form, components })
                    }} className={`col-span-6 ${inputClass}`}>
                      <option value="">{component.name || '—'}</option>
                      {products.filter(candidate => candidate.id !== editing?.id).map(candidate =>
                        <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.sku ? ` (${candidate.sku})` : ''}</option>)}
                    </select>
                    <NumberInput aria-label={t('Quantity')} value={component.quantity} onChange={quantity => {
                      const components = [...form.components]; components[index] = { ...component, quantity }; setForm({ ...form, components })
                    }} className={`col-span-2 ${inputClass}`} />
                    <input aria-label={t('Component note')} placeholder={t('Component note')} value={component.note || ''} onChange={e => {
                      const components = [...form.components]; components[index] = { ...component, note: e.target.value }; setForm({ ...form, components })
                    }} className={`col-span-3 ${inputClass}`} />
                    <button onClick={() => setForm({ ...form, components: form.components.filter((_, i) => i !== index) })} aria-label={t('Remove item')} className="col-span-1 text-serious text-[13px]">✕</button>
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, components: [...form.components, { name: '', quantity: 1 }] })} className="text-[13px] text-brand hover:text-brand-700">{t('+ Add component')}</button>
              </div>
            </div>
          )}

          {/* Advanced options — collapsed so the everyday form stays small */}
          <details className="rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink">{t('Advanced options')}</summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              {isPhysical && <>
                {textField('Barcode', 'barcode')}
                {textField('Brand', 'brand')}
                {textField('Manufacturer', 'manufacturer')}
                {textField('Model', 'model')}
              </>}
              {textField('Vendor / supplier', 'vendor')}
              {isPhysical && textField('Supplier SKU', 'supplierSku')}
              {isPhysical && <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">{numberField('Weight', 'weight')}</div>
                  <label className="block"><span className={labelClass}>{t('Weight unit')}</span>
                    <select aria-label={t('Weight unit')} value={form.weightUnit} onChange={e => setForm({ ...form, weightUnit: e.target.value })} className={inputClass}>
                      {['kg', 'g', 'lb'].map(option => <option key={option} value={option}>{option}</option>)}
                    </select></label>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {numberField('Length', 'length')}
                  {numberField('Width', 'width')}
                  {numberField('Height', 'height')}
                  <label className="block"><span className={labelClass}>{t('Dimension unit')}</span>
                    <select aria-label={t('Dimension unit')} value={form.dimensionUnit} onChange={e => setForm({ ...form, dimensionUnit: e.target.value })} className={inputClass}>
                      {['cm', 'm', 'mm', 'in'].map(option => <option key={option} value={option}>{option}</option>)}
                    </select></label>
                </div>
              </>}
              {textField('Internal notes', 'internalNotes', 'md:col-span-2')}
            </div>
            <div className="mt-4">
              <span className={labelClass}>{t('Custom attributes')}</span>
              <div className="space-y-2">
                {form.attributes.map((attribute, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <input aria-label={t('Attribute name')} placeholder={t('Attribute name')} value={attribute.name} onChange={e => {
                      const attributes = [...form.attributes]; attributes[index] = { ...attribute, name: e.target.value }; setForm({ ...form, attributes })
                    }} className={`col-span-5 ${inputClass}`} />
                    <input aria-label={t('Attribute value')} placeholder={t('Attribute value')} value={attribute.value} onChange={e => {
                      const attributes = [...form.attributes]; attributes[index] = { ...attribute, value: e.target.value }; setForm({ ...form, attributes })
                    }} className={`col-span-6 ${inputClass}`} />
                    <button onClick={() => setForm({ ...form, attributes: form.attributes.filter((_, i) => i !== index) })} aria-label={t('Remove item')} className="col-span-1 text-serious text-[13px]">✕</button>
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, attributes: [...form.attributes, { name: '', value: '' }] })} className="text-[13px] text-brand hover:text-brand-700">{t('+ Add attribute')}</button>
              </div>
            </div>
          </details>

          <div className="flex gap-2">
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
                  <p className="font-medium text-[13px] text-ink">{product.name} {product.sku && <span className="text-[12px] text-muted">({product.sku})</span>}
                    <span className="ms-2 inline-block px-1.5 py-0.5 rounded bg-canvas border border-line text-[11px] text-muted align-middle">{t(PRODUCT_TYPE_LABEL[productType(product)])}</span>
                    {product.category && <span className="ms-1 inline-block px-1.5 py-0.5 rounded bg-canvas border border-line text-[11px] text-muted align-middle">{product.category}</span>}</p>
                  {product.description && <p className="text-[12px] text-muted mt-0.5 truncate">{product.description}</p>}
                  <p className="text-[12px] text-muted mt-0.5">
                    {tracksInventory(product) ? `${number(product.stock)} ${product.unit}` : t('Not tracked')}
                    {' • '}{money(product.unitPrice, prefs.defaultCurrency)}
                    {product.costPrice !== undefined && <> {' • '}{t('Cost price')}: {money(product.costPrice, prefs.defaultCurrency)}</>}
                    {isLowStock(product) && <span className="ms-2 inline-block px-1.5 py-0.5 rounded bg-warn/15 text-warn text-[11px] font-semibold align-middle">{t('Low stock')}</span>}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setForm(formFromProduct(product)); setEditing(product); setShowForm(true) }} title={t('Edit')} aria-label={`${t('Edit')} ${product.name}`} className="p-2 hover:bg-canvas rounded-lg"><Pencil className="w-4 h-4 text-muted" /></button>
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
