import { defaultPreferences } from '../src/lib/preferences'
import type { FatoratiBackup } from '../src/lib/db'

export function fixture(): FatoratiBackup {
  const base = { currency: 'EUR', language: 'en' as const, occurredAt: 100, createdAt: 100, updatedAt: 200 }
  return {
    version: '2.0.0', security:{appLock:true,biometricEnabled:false}, preferences: {...defaultPreferences}, exportedAt: 300,
    businesses: [{ ...base, id: 'business', name: 'متجر Café', ownerName: 'Owner', phone: '', email: '', address: '', city: '' }],
    customers: [{ ...base, id: 'customer', name: 'عميل André', email: '', phone: '', address: '', city: '', notes: '', balance: 0 }],
    projects: [{ ...base, id: 'project', name: 'Work', customerId: 'customer', description: '', status: 'active', budget: 20 }],
    invoices: [{ ...base, id: 'invoice', number: 'INV-1', customerId: 'customer', projectId: 'project', items: [{ id: 'item', description: 'خدمة', quantity: 2, unitPrice: 10, total: 20 }], subtotal: 20, tax: 0, total: 20, status: 'paid', issueDate: '2026-09-01', dueDate: '2026-09-30', notes: '' }],
    estimates: [{ ...base, id: 'estimate', number: 'EST-1', customerId: 'customer', items: [], subtotal: 0, tax: 0, total: 0, status: 'draft', issueDate: '2026-09-01', expiryDate: '2026-09-30', notes: '' }],
    expenses: [{ ...base, id: 'expense', description: 'Dépense', amount: 5, category: 'Travel', date: '2026-09-01', vendor: '' }],
    products: [{ ...base, id: 'product', name: 'Product', description: '', sku: '', unitPrice: 10, unit: 'pc', stock: 3 }],
    settings: [{ ...base, id: 'settings', businessId: 'business', currency: 'EUR', taxRate: 0, invoicePrefix: 'INV', estimatePrefix: 'EST', theme: 'light', language: 'en' }],
  }
}
