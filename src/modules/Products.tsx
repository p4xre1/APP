import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money } from '../lib/fatorati'
import { Plus } from 'lucide-react'

export default function Products() {
  const { products, addProduct, deleteProduct } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', sku: '', unitPrice: 0, unit: 'piece', stock: 0 })

  async function handleAdd() {
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
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-600 mt-1">{products.length} products • 100% offline</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Add Product</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="SKU" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input type="number" placeholder="Unit Price" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: parseFloat(e.target.value) || 0})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Unit" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input type="number" placeholder="Stock" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Save</button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No products yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {products.map((product) => (
              <div key={product.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">{product.name} {product.sku && <span className="text-xs text-gray-500">({product.sku})</span>}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{product.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{product.stock} {product.unit} • {money(product.unitPrice)}</p>
                </div>
                <button onClick={() => deleteProduct(product.id)} className="text-xs text-red-600 hover:text-red-700 px-2 py-1">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
