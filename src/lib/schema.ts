export const STORES = ['businesses', 'customers', 'projects', 'invoices', 'estimates', 'expenses', 'products', 'settings', 'subscriptions'] as const
export type StoreName = typeof STORES[number]
