/**
 * Fatorati Offline - Robust Local Database using IndexedDB
 * Handles hundreds/thousands of invoices, customers, etc.
 * Structure: Businesses, Customers, Projects, Invoices, Estimates, Expenses, Products, Settings
 * 100% Local • Offline - Your data stays on device
 */

export interface Business {
  id: string
  name: string
  ownerName: string
  phone: string
  email: string
  address: string
  logo?: string // base64
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

export interface InvoiceItem {
  id: string
  productId?: string
  description: string
  quantity: number
  unitPrice: number
  total: number
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

export interface FatoratiBackup {
  version: string
  exportedAt: number
  businesses: Business[]
  customers: Customer[]
  projects: Project[]
  invoices: Invoice[]
  estimates: Estimate[]
  expenses: Expense[]
  products: Product[]
  settings: Settings[]
}

const DB_NAME = 'fatorati-offline-v1'
const DB_VERSION = 1
const STORES = ['businesses', 'customers', 'projects', 'invoices', 'estimates', 'expenses', 'products', 'settings'] as const

type StoreName = typeof STORES[number]

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      for (const storeName of STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
          
          if (storeName === 'invoices' || storeName === 'estimates') {
            store.createIndex('customerId', 'customerId', { unique: false })
            store.createIndex('number', 'number', { unique: true })
          }
          if (storeName === 'customers') {
            store.createIndex('name', 'name', { unique: false })
          }
        }
      }
    }
  })
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T[])
  })
}

export async function getById<T>(storeName: StoreName, id: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(id)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as T | undefined)
  })
}

export async function add<T extends { id: string; createdAt: number; updatedAt: number }>(
  storeName: StoreName,
  item: Omit<T, 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<T> {
  const db = await openDB()
  const now = Date.now()
  const fullItem = {
    ...item,
    id: item.id || generateId(),
    createdAt: now,
    updatedAt: now,
  } as T

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.add(fullItem)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(fullItem)
  })
}

export async function update<T extends { id: string; updatedAt: number }>(
  storeName: StoreName,
  id: string,
  patch: Partial<Omit<T, 'id' | 'createdAt'>>
): Promise<T> {
  const existing = await getById<T>(storeName, id)
  if (!existing) throw new Error(`${storeName} with id ${id} not found`)
  
  const updated = {
    ...existing,
    ...patch,
    id,
    updatedAt: Date.now(),
  } as T

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(updated)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(updated)
  })
}

export async function remove(storeName: StoreName, id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(id)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function clear(storeName: StoreName): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Backup and Restore
export async function exportBackup(): Promise<FatoratiBackup> {
  const [businesses, customers, projects, invoices, estimates, expenses, products, settings] = await Promise.all([
    getAll<Business>('businesses'),
    getAll<Customer>('customers'),
    getAll<Project>('projects'),
    getAll<Invoice>('invoices'),
    getAll<Estimate>('estimates'),
    getAll<Expense>('expenses'),
    getAll<Product>('products'),
    getAll<Settings>('settings'),
  ])

  return {
    version: '1.0.0',
    exportedAt: Date.now(),
    businesses,
    customers,
    projects,
    invoices,
    estimates,
    expenses,
    products,
    settings,
  }
}

export async function importBackup(backup: FatoratiBackup): Promise<void> {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES as unknown as string[], 'readwrite')
    
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve()

    for (const storeName of STORES) {
      const store = transaction.objectStore(storeName)
      store.clear()
      
      const items = backup[storeName as keyof FatoratiBackup] as any[]
      if (Array.isArray(items)) {
        for (const item of items) {
          store.add(item)
        }
      }
    }
  })
}

export function downloadBackupFile(backup: FatoratiBackup, filename?: string): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `fatorati-backup-${new Date().toISOString().split('T')[0]}.fatorati`
  a.click()
  URL.revokeObjectURL(url)
}

export async function loadBackupFile(file: File): Promise<FatoratiBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result as string) as FatoratiBackup
        if (!backup.version || !backup.exportedAt) {
          throw new Error('Invalid backup file format')
        }
        resolve(backup)
      } catch (e) {
        reject(e)
      }
    }
    reader.readAsText(file)
  })
}

// Check if onboarding completed
export async function isOnboardingCompleted(): Promise<boolean> {
  const businesses = await getAll<Business>('businesses')
  return businesses.length > 0
}

export async function getBusiness(): Promise<Business | null> {
  const businesses = await getAll<Business>('businesses')
  return businesses[0] || null
}
