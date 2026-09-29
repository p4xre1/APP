import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money, generateInvoiceNumber } from '../lib/fatorati'
import { Plus, Download, Share2 } from 'lucide-react'

export default function Invoices() {
  const { invoices, customers, business, addInvoice, deleteInvoice } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    customerId: '',
    items: [{ description: '', quantity: 1, unitPrice: 0 }],
    notes: '',
  })

  function calculateTotal() {
    const subtotal = form.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    return { subtotal, tax: 0, total: subtotal }
  }

  async function handleAdd() {
    if (!form.customerId || form.items.length === 0) return
    const { subtotal, tax, total } = calculateTotal()
    
    const items = form.items.map(item => ({
      id: Math.random().toString(36).slice(2),
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }))

    await addInvoice({
      number: generateInvoiceNumber('INV'),
      customerId: form.customerId,
      items,
      subtotal,
      tax,
      total,
      status: 'draft',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: form.notes,
    })
    
    setForm({ customerId: '', items: [{ description: '', quantity: 1, unitPrice: 0 }], notes: '' })
    setShowAdd(false)
  }

  function handleShare(invoice: any) {
    const customer = customers.find(c => c.id === invoice.customerId)
    const text = `Invoice ${invoice.number}\nBusiness: ${business?.name}\nCustomer: ${customer?.name}\nTotal: ${money(invoice.total)}\n\nCreate invoice → PDF → Share - Fatorati Offline`
    
    if (navigator.share) {
      navigator.share({ title: `Invoice ${invoice.number}`, text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      alert('Invoice details copied to clipboard')
    }
  }

  function handleDownloadPDF(invoice: any) {
    const customer = customers.find(c => c.id === invoice.customerId)
    const content = `
FATORATI - INVOICE ${invoice.number}
100% Local • Offline

Business: ${business?.name || ''}
Owner: ${business?.ownerName || ''}
${business?.address || ''} ${business?.city || ''}
Phone: ${business?.phone || ''} Email: ${business?.email || ''}

Customer: ${customer?.name || ''}
${customer?.address || ''} ${customer?.city || ''}
Email: ${customer?.email || ''} Phone: ${customer?.phone || ''}

Issue Date: ${invoice.issueDate}
Due Date: ${invoice.dueDate}
Status: ${invoice.status}

Items:
${invoice.items.map((item: any) => `${item.description} - ${item.quantity} x ${money(item.unitPrice)} = ${money(item.total)}`).join('\n')}

Subtotal: ${money(invoice.subtotal)}
Tax: ${money(invoice.tax)}
Total: ${money(invoice.total)}

Notes: ${invoice.notes || ''}

Thank you for your business!
Fatorati • Simple business management • Works offline
    `.trim()

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.number}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const { subtotal, total } = calculateTotal()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-600 mt-1">{invoices.length} invoices • Create invoice → PDF → Share</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Invoice</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                  <input placeholder="Description" value={item.description} onChange={e => {
                    const newItems = [...form.items]
                    newItems[idx].description = e.target.value
                    setForm({...form, items: newItems})
                  }} className="col-span-6 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={e => {
                    const newItems = [...form.items]
                    newItems[idx].quantity = parseFloat(e.target.value) || 0
                    setForm({...form, items: newItems})
                  }} className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <input type="number" placeholder="Price" value={item.unitPrice} onChange={e => {
                    const newItems = [...form.items]
                    newItems[idx].unitPrice = parseFloat(e.target.value) || 0
                    setForm({...form, items: newItems})
                  }} className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <button onClick={() => {
                    setForm({...form, items: form.items.filter((_, i) => i !== idx)})
                  }} className="col-span-1 text-red-600 text-sm">✕</button>
                </div>
              ))}
              <button onClick={() => setForm({...form, items: [...form.items, { description: '', quantity: 1, unitPrice: 0 }]})} className="text-sm text-blue-600 hover:text-blue-700">+ Add item</button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t">
                <span>Total:</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Thank you for your business!" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={3} />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button onClick={handleAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">Create Invoice</button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No invoices yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first invoice → PDF → Share</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {invoices.map((invoice) => {
              const customer = customers.find(c => c.id === invoice.customerId)
              return (
                <div key={invoice.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{invoice.number}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{customer?.name || 'Unknown'} • {invoice.issueDate}</p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                        invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <p className="font-bold text-sm text-gray-900">{money(invoice.total)}</p>
                      </div>
                      <button onClick={() => handleDownloadPDF(invoice)} className="p-2 hover:bg-gray-100 rounded-lg" title="Download PDF">
                        <Download className="w-4 h-4 text-gray-600" />
                      </button>
                      <button onClick={() => handleShare(invoice)} className="p-2 hover:bg-gray-100 rounded-lg" title="Share">
                        <Share2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button onClick={() => deleteInvoice(invoice.id)} className="text-xs text-red-600 hover:text-red-700 px-2 py-1">Delete</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
