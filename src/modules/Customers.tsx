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
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-600 mt-1">{customers.length} customers • 100% offline</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Add Customer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="City" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Save</button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No customers yet</p>
            <p className="text-xs text-gray-400 mt-1">Add your first customer to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map((customer) => (
              <div key={customer.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">{customer.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{customer.email} • {customer.phone}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{customer.city}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteCustomer(customer.id)} className="text-xs text-red-600 hover:text-red-700 px-2 py-1">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
