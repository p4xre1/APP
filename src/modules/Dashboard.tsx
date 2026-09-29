/**
 * Fatorati Offline - Dashboard
 * 100% Local • Offline - Simple business management
 */

import { useFatorati } from '../store/useFatorati'
import { money } from '../lib/fatorati'

export default function Dashboard() {
  const { customers, invoices, expenses, products, business } = useFatorati()
  
  const stats = {
    totalCustomers: customers.length,
    totalInvoices: invoices.length,
    totalRevenue: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0),
    pendingInvoices: invoices.filter(inv => inv.status === 'sent').length,
    totalExpenses: expenses.reduce((sum, exp) => sum + exp.amount, 0),
    totalProducts: products.length,
  }

  const recentInvoices = invoices.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Welcome back, {business?.ownerName || 'Owner'} • {business?.name} • 100% Local • Offline
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Customers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCustomers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <span className="text-xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalInvoices}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.pendingInvoices} pending</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <span className="text-xl">📄</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{money(stats.totalRevenue)}</p>
              <p className="text-xs text-green-600 mt-1">Paid invoices</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <span className="text-xl">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expenses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{money(stats.totalExpenses)}</p>
              <p className="text-xs text-gray-500 mt-1">{expenses.length} records</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <span className="text-xl">💸</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Invoices</h2>
          {recentInvoices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No invoices yet</p>
              <p className="text-xs text-gray-400 mt-1">Create invoice → PDF → Share</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{inv.number}</p>
                    <p className="text-xs text-gray-600">{inv.customerId}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm text-gray-900">{money(inv.total)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                      inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">100% Local • Offline</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <span className="font-semibold text-gray-900">Fatorati - Simple business management.</span> No subscription. Your customers, invoices and business records stay on your device. Works offline.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-medium text-blue-900 text-xs">How it works:</p>
              <p className="text-blue-800 text-xs mt-1">Create invoice → PDF → Share - easy for US customers</p>
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Your data stays on device - 100% offline
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                No subscription, no cloud dependency
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Works offline, airplane mode ready
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Export backup .fatorati file anytime
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            <p className="text-xs text-gray-600 mt-1">Customers</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            <p className="text-xs text-gray-600 mt-1">Products</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            <p className="text-xs text-gray-600 mt-1">Invoices</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
            <p className="text-xs text-gray-600 mt-1">Expenses</p>
          </div>
        </div>
      </div>
    </div>
  )
}
