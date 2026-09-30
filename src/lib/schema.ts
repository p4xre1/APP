export const STORES = ['businesses', 'customers', 'projects', 'invoices', 'estimates', 'expenses', 'products', 'settings', 'subscriptions', 'notes'] as const
export type StoreName = typeof STORES[number]
