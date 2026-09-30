/**
 * Fatorati Offline - Main Store
 * 100% Local • Offline - Simple business management
 * No subscription. Your data stays on device. Works offline.
 * Uses IndexedDB for robust storage handling hundreds/thousands of records
 */

import { create } from 'zustand'
import { getPreferences } from '../lib/preferences'
import { DEFAULT_TAX_REGION } from '../lib/taxGuide'
import { reminderSettings, syncReminders } from '../lib/notifications'
import { sessionGuard, unlockedSnapshot } from '../lib/vault'
import { errorText } from '../i18n'
import * as db from '../lib/db'
import { generateId } from '../lib/db'
import type { ImportMode, ImportSummary } from '../lib/backup-format'
import type { Business, Customer, Project, Invoice, Estimate, Expense, Product, Settings, Subscription, Note } from './types'

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
  subscriptions: Subscription[]
  notes: Note[]
  
  // UI
  isOnboarded: boolean
  isLoading: boolean
  /** Set when records exist but cannot be read. Never treated as "no data". */
  loadError: string | null
  
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
  
  // Subscriptions
  loadSubscriptions: () => Promise<void>
  addSubscription: (subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Subscription>
  updateSubscription: (id: string, patch: Partial<Subscription>) => Promise<void>
  deleteSubscription: (id: string) => Promise<void>
  // Notebook
  loadNotes: () => Promise<void>
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Note>
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>
  deleteNote: (id: string) => Promise<void>

  /** Rebuilds every pending local notification (notes and subscriptions) from the current data. */
  resyncReminders: () => Promise<{ scheduled: number; cancelled: number; permission: string }>

  // Settings
  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  
  // Dashboard
  
  // Backup
  exportBackup: (password?: string) => Promise<void>
  importBackup: (backup: db.FatoratiBackup, mode: ImportMode) => Promise<ImportSummary>
  
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
  subscriptions: [],
  notes: [],
  isOnboarded: false,
  isLoading: true,
  loadError: null,

  init: async () => {
    const guard = sessionGuard()
    set({ isLoading: true, loadError: null })
    try {
      const snapshot = await unlockedSnapshot()
      const business = snapshot.stores.businesses[0] as unknown as Business | undefined
      if (business) {
        const { customers, projects, invoices, estimates, expenses, products, settings: settingsList, subscriptions, notes } = snapshot.stores
        guard()
        set({
          business,
          customers: customers as unknown as Customer[],
          projects: projects as unknown as Project[],
          invoices: invoices as unknown as Invoice[],
          estimates: estimates as unknown as Estimate[],
          expenses: expenses as unknown as Expense[],
          products: products as unknown as Product[],
          settings: (settingsList[0] as unknown as Settings) || null,
          subscriptions: subscriptions as unknown as Subscription[],
          notes: notes as unknown as Note[],
          isOnboarded: true,
          isLoading: false,
          loadError: null,
        })
      } else {
        set({ business: null, customers: [], projects: [], invoices: [], estimates: [], expenses: [], products: [], settings: null, subscriptions: [], notes: [], isOnboarded: false, isLoading: false, loadError: null })
      }
    } catch (e) {
      console.error('Failed to init Fatorati:', e)
      // Fail visible: a damaged or locked vault must never look like an empty install.
      set({ business: null, customers: [], projects: [], invoices: [], estimates: [], expenses: [], products: [], settings: null, subscriptions: [], notes: [], isOnboarded: false, isLoading: false, loadError: errorText(e) })
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
      currency: business.currency || getPreferences().defaultCurrency,
      taxRate: 0,
      invoicePrefix: 'INV',
      estimatePrefix: 'EST',
      theme: getPreferences().theme,
      language: getPreferences().language,
      taxRegion: DEFAULT_TAX_REGION,
      taxAssistantVisible: true,
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
      subscriptions: [],
      notes: [],
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

  loadSubscriptions: async () => {
    const subscriptions = await db.getAll<Subscription>('subscriptions')
    set({ subscriptions })
  },

  addSubscription: async (subscriptionData) => {
    const subscription = await db.add<Subscription>('subscriptions', subscriptionData)
    set((s) => ({ subscriptions: [subscription, ...s.subscriptions] }))
    void get().resyncReminders()
    return subscription
  },

  updateSubscription: async (id, patch) => {
    const updated = await db.update<Subscription>('subscriptions', id, patch)
    set((s) => ({ subscriptions: s.subscriptions.map((row) => (row.id === id ? updated : row)) }))
    void get().resyncReminders()
  },

  deleteSubscription: async (id) => {
    await db.remove('subscriptions', id)
    set((s) => ({ subscriptions: s.subscriptions.filter((row) => row.id !== id) }))
    void get().resyncReminders()
  },

  loadNotes: async () => {
    const notes = await db.getAll<Note>('notes')
    set({ notes })
  },

  addNote: async (noteData) => {
    const note = await db.add<Note>('notes', noteData)
    set((s) => ({ notes: [note, ...s.notes] }))
    // A new note can carry a reminder, so the pending set is rebuilt from scratch.
    void get().resyncReminders()
    return note
  },

  updateNote: async (id, patch) => {
    const updated = await db.update<Note>('notes', id, patch)
    set((s) => ({ notes: s.notes.map((note) => (note.id === id ? updated : note)) }))
    void get().resyncReminders()
  },

  deleteNote: async (id) => {
    await db.remove('notes', id)
    set((s) => ({ notes: s.notes.filter((note) => note.id !== id) }))
    void get().resyncReminders()
  },

  resyncReminders: async () => {
    const { notes, subscriptions, settings } = get()
    try {
      return await syncReminders(notes, subscriptions, reminderSettings(settings))
    } catch {
      return { scheduled: 0, cancelled: 0, permission: 'unsupported' }
    }
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
    if (Object.keys(patch).some(key => key.startsWith('subscription'))) void get().resyncReminders()
  },

  exportBackup: async (password) => {
    const backup = await db.exportBackup()
    await db.downloadBackupFile(backup, password)
  },

  importBackup: async (backup, mode) => {
    const summary = await db.importBackup(backup, mode)
    // Reload after Settings displays the commit result, rather than unmounting its dialog.
    return summary
  },
}))
