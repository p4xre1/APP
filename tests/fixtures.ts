import { defaultPreferences } from '../src/lib/preferences'
import { BACKUP_VERSION } from '../src/lib/backup-format'
import { LEGACY_TEMPLATE } from '../src/lib/templates'
import type { FatoratiBackup } from '../src/lib/db'

/** The snapshot a document written before templates existed resolves to. */
const legacySnapshot = () => ({ ...LEGACY_TEMPLATE, labels: { ...LEGACY_TEMPLATE.labels } })

export function fixture(): FatoratiBackup {
  const base = { currency: 'EUR', language: 'en' as const, occurredAt: 100, createdAt: 100, updatedAt: 200 }
  return {
    version: BACKUP_VERSION, security:{appLock:true,biometricEnabled:false}, preferences: {...defaultPreferences}, exportedAt: 300,
    businesses: [{ ...base, id: 'business', name: 'متجر Café', ownerName: 'Owner', phone: '', email: '', address: '', city: '' }],
    customers: [{ ...base, id: 'customer', name: 'عميل André', email: '', phone: '', address: '', city: '', notes: '', balance: 0 }],
    projects: [{ ...base, id: 'project', name: 'Work', customerId: 'customer', description: '', status: 'active', budget: 20 }],
    invoices: [{ ...base, id: 'invoice', number: 'INV-1', customerId: 'customer', projectId: 'project', items: [{ id: 'item', description: 'خدمة', quantity: 2, unitPrice: 10, total: 20 }], subtotal: 20, tax: 0, total: 20, status: 'paid', issueDate: '2026-09-01', dueDate: '2026-09-30', notes: '', template: legacySnapshot() }],
    estimates: [{ ...base, id: 'estimate', number: 'EST-1', customerId: 'customer', items: [], subtotal: 0, tax: 0, total: 0, status: 'draft', issueDate: '2026-09-01', expiryDate: '2026-09-30', notes: '', template: legacySnapshot() }],
    expenses: [{ ...base, id: 'expense', description: 'Dépense', amount: 5, category: 'Travel', date: '2026-09-01', vendor: '' }],
    products: [{ ...base, id: 'product', name: 'Product', description: '', sku: '', unitPrice: 10, unit: 'pc', stock: 3 }],
    settings: [{ ...base, id: 'settings', businessId: 'business', currency: 'EUR', taxRate: 0, invoicePrefix: 'INV', estimatePrefix: 'EST', theme: 'light', language: 'en', taxRegion: 'MA' }],
    subscriptions: [{ ...base, id: 'subscription', serviceName: 'مرصد Service', amountMinor: 9900, currency: 'EUR', billingCycle: 'monthly', autoRenew: true, startDate: '2026-01-31' }],
  }
}

/**
 * The same data as a genuine 3.0.0 file: no template snapshot anywhere, and the
 * settings row before the template defaults existed. Used to prove that importing
 * an older backup still works and that old documents keep the legacy look.
 */
export function legacyFixture(): FatoratiBackup {
  const copy = JSON.parse(JSON.stringify(fixture())) as FatoratiBackup & Record<string, unknown>
  copy.version = '3.0.0'
  for (const name of ['invoices', 'estimates'] as const) {
    for (const row of copy[name] as unknown as Record<string, unknown>[]) delete row.template
  }
  const settings = copy.settings[0] as unknown as Record<string, unknown>
  delete settings.templateLayout; delete settings.templatePreset; delete settings.templateAccent
  return copy
}
