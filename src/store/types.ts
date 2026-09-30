import type { Language } from '../lib/preferences'
/**
 * Fatorati Offline - Types
 * 100% Local • Offline - Simple business management
 * Structure: Businesses, Customers, Projects, Invoices, Estimates, Expenses, Products, Settings
 */

export type ModuleKey =
  | 'dashboard'
  | 'customers'
  | 'projects'
  | 'invoices'
  | 'estimates'
  | 'expenses'
  | 'products'
  | 'reports'
  | 'subscriptions'
  | 'settings'
  /** Full-screen tax guide; opened from Settings, not part of the sidebar. */
  | 'taxGuide'

/** Billing cadence of a tracked subscription. */
export type SubscriptionCycle = 'monthly' | 'yearly' | 'one_time_period'

/** Currency a subscription may be billed in. Amounts are stored in minor units. */
export type SubscriptionCurrency = 'MAD' | 'USD' | 'EUR'

/**
 * A recurring payment the user tracks. Money is stored as an integer number of
 * minor units (centimes/cents) so sums never drift, like the rest of the vault.
 */
export interface Subscription {
  id: string
  serviceName: string
  category?: string
  amountMinor: number
  currency: SubscriptionCurrency
  billingCycle: SubscriptionCycle
  /** Months covered by one payment when billingCycle is 'one_time_period'. */
  periodMonths?: number
  autoRenew: boolean
  /** ISO calendar date, YYYY-MM-DD, in the device's local calendar. */
  startDate: string
  paymentMethod?: string
  notes?: string
  /** UTC milliseconds when the user cancelled it. */
  cancelledAt?: number
  createdAt: number
  updatedAt: number
}

/** Country whose invoice and tax guidance the assistant shows. */
export type TaxRegion = 'MA' | 'US'

export interface Business {
  currency?: string
  taxNumber?: string
  id: string
  name: string
  ownerName: string
  phone: string
  email: string
  address: string
  city: string
  logo?: string
  createdAt: number
  updatedAt: number
}

export interface Customer {
  taxNumber?: string
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  notes: string
  balance: number
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  customerId: string
  description: string
  status: 'planning' | 'active' | 'on_hold' | 'done'
  budget: number
  createdAt: number
  updatedAt: number
}

export interface InvoiceItem {
  id: string
  productId?: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Invoice {
  taxRate?: number // Percent applied to the subtotal; absent/0 means no tax.
  paidAt?: number // UTC milliseconds when the invoice was marked paid.
  currency?: string
  language?: Language
  exchangeRate?: number // Default-currency units for one unit of this currency.
  rateCurrency?: string // Currency the manual exchange rate targets.
  occurredAt?: number // UTC milliseconds.
  pdfColor?: boolean
  id: string
  number: string
  customerId: string
  projectId?: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  issueDate: string
  dueDate: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Estimate {
  taxRate?: number
  currency?: string
  language?: Language
  exchangeRate?: number // Default-currency units for one unit of this currency.
  rateCurrency?: string // Currency the manual exchange rate targets.
  occurredAt?: number // UTC milliseconds.
  pdfColor?: boolean
  id: string
  number: string
  customerId: string
  projectId?: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  issueDate: string
  expiryDate: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Expense {
  currency?: string
  language?: Language
  exchangeRate?: number // Default-currency units for one unit of this currency.
  rateCurrency?: string // Currency the manual exchange rate targets.
  occurredAt?: number // UTC milliseconds.
  pdfColor?: boolean
  id: string
  description: string
  amount: number
  category: string
  date: string
  vendor: string
  receipt?: string
  createdAt: number
  updatedAt: number
}

export interface Product {
  id: string
  name: string
  description: string
  sku: string
  unitPrice: number
  unit: string
  stock: number
  createdAt: number
  updatedAt: number
}

export interface Settings {
  id: string
  businessId: string
  currency: string
  taxRate: number
  invoicePrefix: string
  estimatePrefix: string
  theme: 'light' | 'dark' | 'system'
  language: Language
  /** Region used for new documents. Absent on installs created before the tax assistant. */
  taxRegion?: TaxRegion
  /** Tax assistant visibility. Absent means visible (the default). */
  taxAssistantVisible?: boolean
  /** Region shown inside the assistant; switching there never changes taxRegion. */
  taxAssistantRegion?: TaxRegion
  /** Set after the assistant has been shown once, so it then starts collapsed. */
  taxAssistantSeen?: boolean
  /** Subscription reminders: opt-in, so absent means off. */
  subscriptionReminders?: boolean
  /** How many days before a renewal to remind. Clamped to 1-30 by the UI. */
  subscriptionWarnDays?: number
  /** Also remind on the renewal/end day itself. */
  subscriptionDayOfReminder?: boolean
  /** Hide service names from notification text (default ON). */
  subscriptionHideNames?: boolean
  createdAt: number
  updatedAt: number
}
