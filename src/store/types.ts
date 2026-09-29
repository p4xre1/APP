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
  | 'calendar'
  | 'reports'
  | 'settings'

export interface Business {
  currency?: string
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
  /** UTC milliseconds when the invoice was marked paid; used as its payment date. */
  paidAt?: number
  issueDate: string
  dueDate: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Estimate {
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
  createdAt: number
  updatedAt: number
}

export interface DashboardStats {
  totalCustomers: number
  totalInvoices: number
  totalRevenue: number
  pendingInvoices: number
  overdueInvoices: number
  totalExpenses: number
}
