import { useFatorati } from '../store/useFatorati'
import { money } from '../lib/fatorati'

export default function Reports() {
  const { invoices, expenses, customers } = useFatorati()

  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const profit = totalRevenue - totalExpenses
  const pendingRevenue = invoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.total, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-600 mt-1">Business reports • 100% offline</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600">Total Revenue (Paid)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{money(totalRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">{invoices.filter(inv => inv.status === 'paid').length} invoices</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600">Pending Revenue</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{money(pendingRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">{invoices.filter(inv => inv.status === 'sent').length} sent</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-600">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{money(totalExpenses)}</p>
          <p className="text-xs text-gray-500 mt-1">{expenses.length} records</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profit & Loss</h2>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Revenue (Paid Invoices)</span>
            <span className="text-sm font-medium text-green-600">{money(totalRevenue)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Expenses</span>
            <span className="text-sm font-medium text-red-600">-{money(totalExpenses)}</span>
          </div>
          <div className="flex justify-between py-3 font-bold text-lg">
            <span>Net Profit</span>
            <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{money(profit)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            <p className="text-xs text-gray-600 mt-1">Customers</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            <p className="text-xs text-gray-600 mt-1">Invoices</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
            <p className="text-xs text-gray-600 mt-1">Expenses</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{money(profit)}</p>
            <p className="text-xs text-gray-600 mt-1">Profit</p>
          </div>
        </div>
      </div>
    </div>
  )
}
