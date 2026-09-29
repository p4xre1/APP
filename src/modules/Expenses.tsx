import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money } from '../lib/fatorati'
import { Plus } from 'lucide-react'

export default function Expenses() {
  const { expenses, addExpense, deleteExpense } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ description: '', amount: 0, category: '', vendor: '', date: new Date().toISOString().split('T')[0] })

  async function handleAdd() {
    if (!form.description.trim() || form.amount <= 0) return
    await addExpense({
      description: form.description.trim(),
      amount: form.amount,
      category: form.category.trim(),
      vendor: form.vendor.trim(),
      date: form.date,
    })
    setForm({ description: '', amount: 0, category: '', vendor: '', date: new Date().toISOString().split('T')[0] })
    setShowAdd(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-600 mt-1">{expenses.length} expenses • 100% offline</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Add Expense</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Description *" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input type="number" placeholder="Amount *" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Vendor" value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Save</button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {expenses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No expenses yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {expenses.map((expense) => (
              <div key={expense.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">{expense.description}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{expense.category} • {expense.vendor} • {expense.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-gray-900">{money(expense.amount)}</p>
                  <button onClick={() => deleteExpense(expense.id)} className="text-xs text-red-600 hover:text-red-700 px-2 py-1">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
