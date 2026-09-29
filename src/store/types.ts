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
  | 'settings'

export interface Business {
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
  currency: 'USD' | 'EUR'
  taxRate: number
  invoicePrefix: string
  estimatePrefix: string
  theme: 'light' | 'dark'
  language: 'en'
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
