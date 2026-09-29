/**
 * Fatorati Offline - Main Store
 * 100% Local • Offline - Simple business management
 * No subscription. Your data stays on device. Works offline.
 * Uses IndexedDB for robust storage handling hundreds/thousands of records
 */

import { create } from 'zustand'
import * as db from '../lib/db'
import { generateId } from '../lib/db'
import type { Business, Customer, Project, Invoice, Estimate, Expense, Product, Settings, DashboardStats } from './types'

interface FatoratiState {
  // Data
  business: Business | null
  customers: Customer[]
  projects: Project[]
  invoices: Invoice[]
  estimates: Estimate[]
  expenses: Expense[]
  products: Product[]
  settings: Settings | null
  
  // UI
  isOnboarded: boolean
  isLoading: boolean
  
  // Business
  setBusiness: (business: Business) => Promise<void>
  updateBusiness: (patch: Partial<Business>) => Promise<void>
  
  // Customers
  loadCustomers: () => Promise<void>
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Customer>
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  
  // Projects
  loadProjects: () => Promise<void>
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  
  // Invoices
  loadInvoices: () => Promise<void>
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Invoice>
  updateInvoice: (id: string, patch: Partial<Invoice>) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  
  // Estimates
  loadEstimates: () => Promise<void>
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Estimate>
  updateEstimate: (id: string, patch: Partial<Estimate>) => Promise<void>
  deleteEstimate: (id: string) => Promise<void>
  
  // Expenses
  loadExpenses: () => Promise<void>
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Expense>
  updateExpense: (id: string, patch: Partial<Expense>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  
  // Products
  loadProducts: () => Promise<void>
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  
  // Settings
  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  
  // Dashboard
  getDashboardStats: () => DashboardStats
  
  // Backup
  exportBackup: () => Promise<void>
  importBackup: (file: File) => Promise<void>
  
  // Init
  init: () => Promise<void>
  completeOnboarding: (business: Omit<Business, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
}

export const useFatorati = create<FatoratiState>((set, get) => ({
  business: null,
  customers: [],
  projects: [],
  invoices: [],
  estimates: [],
  expenses: [],
  products: [],
  settings: null,
  isOnboarded: false,
  isLoading: true,

  init: async () => {
    set({ isLoading: true })
    try {
      const isOnboarded = await db.isOnboardingCompleted()
      const business = await db.getBusiness()
      
      if (isOnboarded && business) {
        const [customers, projects, invoices, estimates, expenses, products, settingsList] = await Promise.all([
          db.getAll<Customer>('customers'),
          db.getAll<Project>('projects'),
          db.getAll<Invoice>('invoices'),
          db.getAll<Estimate>('estimates'),
          db.getAll<Expense>('expenses'),
          db.getAll<Product>('products'),
          db.getAll<Settings>('settings'),
        ])
        
        set({
          business,
          customers,
          projects,
          invoices,
          estimates,
          expenses,
          products,
          settings: settingsList[0] || null,
          isOnboarded: true,
          isLoading: false,
        })
      } else {
        set({ isOnboarded: false, isLoading: false })
      }
    } catch (e) {
      console.error('Failed to init Fatorati:', e)
      set({ isLoading: false })
    }
  },

  completeOnboarding: async (businessData) => {
    const business: Business = {
      ...businessData,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    
    await db.add<Business>('businesses', business)
    
    const settings: Settings = {
      id: generateId(),
      businessId: business.id,
      currency: 'USD',
      taxRate: 0,
      invoicePrefix: 'INV',
      estimatePrefix: 'EST',
      theme: 'light',
      language: 'en',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    
    await db.add<Settings>('settings', settings)
    
    set({
      business,
      settings,
      isOnboarded: true,
      customers: [],
      projects: [],
      invoices: [],
      estimates: [],
      expenses: [],
      products: [],
    })
  },

  setBusiness: async (business) => {
    await db.update<Business>('businesses', business.id, business)
    set({ business })
  },

  updateBusiness: async (patch) => {
    const { business } = get()
    if (!business) return
    const updated = await db.update<Business>('businesses', business.id, patch)
    set({ business: updated })
  },

  loadCustomers: async () => {
    const customers = await db.getAll<Customer>('customers')
    set({ customers })
  },

  addCustomer: async (customerData) => {
    const customer = await db.add<Customer>('customers', customerData)
    set((s) => ({ customers: [customer, ...s.customers] }))
    return customer
  },

  updateCustomer: async (id, patch) => {
    const updated = await db.update<Customer>('customers', id, patch)
    set((s) => ({
      customers: s.customers.map((c) => (c.id === id ? updated : c)),
    }))
  },

  deleteCustomer: async (id) => {
    await db.remove('customers', id)
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }))
  },

  loadProjects: async () => {
    const projects = await db.getAll<Project>('projects')
    set({ projects })
  },

  addProject: async (projectData) => {
    const project = await db.add<Project>('projects', projectData)
    set((s) => ({ projects: [project, ...s.projects] }))
    return project
  },

  updateProject: async (id, patch) => {
    const updated = await db.update<Project>('projects', id, patch)
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }))
  },

  deleteProject: async (id) => {
    await db.remove('projects', id)
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
  },

  loadInvoices: async () => {
    const invoices = await db.getAll<Invoice>('invoices')
    set({ invoices })
  },

  addInvoice: async (invoiceData) => {
    const invoice = await db.add<Invoice>('invoices', invoiceData)
    set((s) => ({ invoices: [invoice, ...s.invoices] }))
    return invoice
  },

  updateInvoice: async (id, patch) => {
    const updated = await db.update<Invoice>('invoices', id, patch)
    set((s) => ({
      invoices: s.invoices.map((inv) => (inv.id === id ? updated : inv)),
    }))
  },

  deleteInvoice: async (id) => {
    await db.remove('invoices', id)
    set((s) => ({ invoices: s.invoices.filter((inv) => inv.id !== id) }))
  },

  loadEstimates: async () => {
    const estimates = await db.getAll<Estimate>('estimates')
    set({ estimates })
  },

  addEstimate: async (estimateData) => {
    const estimate = await db.add<Estimate>('estimates', estimateData)
    set((s) => ({ estimates: [estimate, ...s.estimates] }))
    return estimate
  },

  updateEstimate: async (id, patch) => {
    const updated = await db.update<Estimate>('estimates', id, patch)
    set((s) => ({
      estimates: s.estimates.map((est) => (est.id === id ? updated : est)),
    }))
  },

  deleteEstimate: async (id) => {
    await db.remove('estimates', id)
    set((s) => ({ estimates: s.estimates.filter((est) => est.id !== id) }))
  },

  loadExpenses: async () => {
    const expenses = await db.getAll<Expense>('expenses')
    set({ expenses })
  },

  addExpense: async (expenseData) => {
    const expense = await db.add<Expense>('expenses', expenseData)
    set((s) => ({ expenses: [expense, ...s.expenses] }))
    return expense
  },

  updateExpense: async (id, patch) => {
    const updated = await db.update<Expense>('expenses', id, patch)
    set((s) => ({
      expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
    }))
  },

  deleteExpense: async (id) => {
    await db.remove('expenses', id)
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
  },

  loadProducts: async () => {
    const products = await db.getAll<Product>('products')
    set({ products })
  },

  addProduct: async (productData) => {
    const product = await db.add<Product>('products', productData)
    set((s) => ({ products: [product, ...s.products] }))
    return product
  },

  updateProduct: async (id, patch) => {
    const updated = await db.update<Product>('products', id, patch)
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? updated : p)),
    }))
  },

  deleteProduct: async (id) => {
    await db.remove('products', id)
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
  },

  loadSettings: async () => {
    const settingsList = await db.getAll<Settings>('settings')
    set({ settings: settingsList[0] || null })
  },

  updateSettings: async (patch) => {
    const { settings } = get()
    if (!settings) return
    const updated = await db.update<Settings>('settings', settings.id, patch)
    set({ settings: updated })
  },

  getDashboardStats: () => {
    const { customers, invoices, expenses } = get()
    const totalRevenue = invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0)
    const pendingInvoices = invoices.filter((inv) => inv.status === 'sent').length
    const overdueInvoices = invoices.filter((inv) => inv.status === 'overdue').length
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

    return {
      totalCustomers: customers.length,
      totalInvoices: invoices.length,
      totalRevenue,
      pendingInvoices,
      overdueInvoices,
      totalExpenses,
    }
  },

  exportBackup: async () => {
    const backup = await db.exportBackup()
    db.downloadBackupFile(backup)
  },

  importBackup: async (file) => {
    const backup = await db.loadBackupFile(file)
    await db.importBackup(backup)
    await get().init()
  },
}))
