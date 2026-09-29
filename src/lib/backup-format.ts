import type { FatoratiBackup } from './db'

export const BACKUP_VERSION = '3.0.0'
import { STORES, RECORD_STORES, type StoreName } from './schema'
export { STORES, RECORD_STORES } from './schema'
export type { StoreName } from './schema'
import { defaultPreferences, validPreferences, validCurrency, languages } from './preferences'
import { roundMoney } from './format'
export type ImportMode = 'replace' | 'merge'
export interface ImportSummary { added: number; updated: number; deleted: number; skipped: number }

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const timestamp = (value: unknown) => finite(value) && value >= 0 && value <= 8.64e15
const strings: Record<StoreName, string[]> = {
  businesses: ['name', 'ownerName', 'phone', 'email', 'address'],
  customers: ['name', 'email', 'phone', 'address', 'city', 'notes'],
  projects: ['name', 'customerId', 'description'],
  invoices: ['number', 'customerId', 'issueDate', 'dueDate', 'notes'],
  estimates: ['number', 'customerId', 'issueDate', 'expiryDate', 'notes'],
  expenses: ['description', 'category', 'date', 'vendor'],
  products: ['name', 'description', 'sku', 'unit'],
  settings: ['businessId', 'invoicePrefix', 'estimatePrefix'],
  tombstones: ['store'],
}
const numbers: Record<StoreName, string[]> = {
  businesses: [], customers: ['balance'], projects: ['budget'],
  invoices: ['subtotal', 'tax', 'total'], estimates: ['subtotal', 'tax', 'total'],
  expenses: ['amount'], products: ['unitPrice', 'stock'], settings: ['taxRate'], tombstones: [],
}
const enums: Partial<Record<StoreName, Record<string, string[]>>> = {
  projects: { status: ['planning', 'active', 'on_hold', 'done'] },
  invoices: { status: ['draft', 'sent', 'paid', 'overdue'] },
  estimates: { status: ['draft', 'sent', 'accepted', 'declined'] },
  settings: { theme: ['light', 'dark', 'system'], language: [...languages] },
  tombstones: { store: [...RECORD_STORES] },
}

/** Validate everything before opening a write transaction. Legacy unencrypted v1 files remain valid. */
export function validateBackup(value: unknown): asserts value is FatoratiBackup {
  if (!object(value) || value.version !== BACKUP_VERSION) {
    throw new Error('Unsupported backup version')
  }
  if (!object(value.security) || value.security.appLock !== true || typeof value.security.biometricEnabled !== 'boolean') throw new Error('Invalid settings')
  if (!validPreferences(value.preferences)) throw new Error('Invalid settings')
  if (!timestamp(value.exportedAt)) throw new Error('Invalid backup export date.')
  for (const name of STORES) {
    const records = value[name]
    if (!Array.isArray(records)) throw new Error('Invalid backup structure')
    const ids = new Set<string>()
    for (const record of records) {
      const invalid = () => new Error('Invalid backup record; no data was changed')
      if (!object(record) || typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id)
        || !timestamp(record.createdAt) || !timestamp(record.updatedAt)) throw invalid()
      ids.add(record.id)
      if (strings[name].some(key => typeof record[key] !== 'string')
        || numbers[name].some(key => !finite(record[key]))) throw invalid()
      for (const [key, choices] of Object.entries(enums[name] || {})) {
        if (!choices.includes(record[key] as string)) throw invalid()
      }
      if (name === 'tombstones' && !timestamp(record.deletedAt)) throw invalid()
      if (['invoices','estimates','expenses','settings','businesses'].includes(name) && !validCurrency(record.currency)) throw invalid()
      if (['invoices','estimates','expenses'].includes(name)) {
        if (!languages.includes(record.language as typeof languages[number]) || !timestamp(record.occurredAt)) throw invalid()
        if (record.exchangeRate !== undefined && (!finite(record.exchangeRate) || record.exchangeRate <= 0 || !validCurrency(record.rateCurrency))) throw invalid()
        if (record.pdfColor !== undefined && typeof record.pdfColor !== 'boolean') throw invalid()
      }
      const optional = name === 'businesses' ? ['city', 'logo']
        : name === 'expenses' ? ['receipt']
        : name === 'invoices' || name === 'estimates' ? ['projectId'] : []
      if (optional.some(key => record[key] !== undefined && typeof record[key] !== 'string')) throw invalid()
      if (name === 'invoices' || name === 'estimates') {
        if (!Array.isArray(record.items)) throw invalid()
        const itemIds = new Set<string>()
        for (const item of record.items) {
          if (!object(item) || typeof item.id !== 'string' || !item.id.trim() || itemIds.has(item.id)
            || typeof item.description !== 'string'
            || !['quantity', 'unitPrice', 'total'].every(key => finite(item[key]))
            || (item.productId !== undefined && typeof item.productId !== 'string')) throw invalid()
          itemIds.add(item.id)
        }
      }
    }
  }
}

const ITERATIONS = 600_000
interface EncryptedBackup {
  format: 'fatorati-encrypted'
  version: 1
  algorithm: 'AES-GCM'
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export class PasswordRequiredError extends Error {
  constructor() { super('This backup is encrypted. Enter its password.'); this.name = 'PasswordRequiredError' }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0))
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations = ITERATIONS): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure encryption is not available on this device.')
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

export async function encodeBackup(backup: FatoratiBackup, password = ''): Promise<string> {
  validateBackup(backup)
  const json = JSON.stringify(backup, (key, value) => ['createdAt','updatedAt','occurredAt','exportedAt'].includes(key) && typeof value === 'number' ? new Date(value).toISOString() : value)
  if (!password) return json
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json))
  const header: EncryptedBackup = {
    format: 'fatorati-encrypted', version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)),
  }
  return JSON.stringify(header)
}

export async function decodeBackup(text: string, password?: string): Promise<FatoratiBackup> {
  let value: unknown
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')) }
  catch { throw new Error('Invalid backup: the file is not valid JSON.') }
  if (object(value) && value.format === 'fatorati-encrypted') {
    if (value.version !== 1 || value.algorithm !== 'AES-GCM' || value.kdf !== 'PBKDF2-SHA256'
      || value.iterations !== ITERATIONS || typeof value.salt !== 'string'
      || typeof value.iv !== 'string' || typeof value.ciphertext !== 'string') {
      throw new Error('Unsupported or damaged encrypted backup header.')
    }
    let salt: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>, ciphertext: Uint8Array<ArrayBuffer>
    try {
      salt = fromBase64(value.salt); iv = fromBase64(value.iv); ciphertext = fromBase64(value.ciphertext)
      if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error()
    } catch { throw new Error('Damaged encrypted backup header.') }
    if (password === undefined) throw new PasswordRequiredError()
    const key = await deriveKey(password, salt)
    let decrypted: ArrayBuffer
    try { decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext) }
    catch { throw new Error('Wrong password or damaged encrypted backup. No data was changed.') }
    try { value = JSON.parse(new TextDecoder().decode(decrypted)) }
    catch { throw new Error('Invalid encrypted backup contents.') }
  }
  return migrateBackup(value)
}

/** v1 -> v2; ISO timestamps in portable files -> UTC milliseconds in memory. */
export function migrateBackup(input: unknown): FatoratiBackup {
  if (!object(input) || !['1.0.0', '2.0.0', BACKUP_VERSION].includes(input.version as string)) throw new Error('Unsupported backup version')
  const value = JSON.parse(JSON.stringify(input), (key, item) => {
    if (['createdAt','updatedAt','occurredAt','exportedAt'].includes(key) && typeof item === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(item)) return Date.parse(item)
    return item
  }) as Record<string, unknown>
  if(value.version === '1.0.0') {
    const settings = Array.isArray(value.settings) ? value.settings[0] : undefined
    const currency = settings?.currency || 'USD'
    if(!validCurrency(currency)) throw new Error('Invalid backup structure')
    value.security = {appLock:true,biometricEnabled:false}
    value.preferences = {...defaultPreferences, language: settings?.language || 'en', defaultCurrency:currency, theme:settings?.theme || 'system', updatedAt:0}
    for(const name of STORES) {
      const rows=value[name]
      if(!Array.isArray(rows)) throw new Error('Invalid backup structure')
      for(const row of rows) {
        if(!object(row)) throw new Error('Invalid backup structure')
        if(['businesses','invoices','estimates','expenses'].includes(name)) row.currency = currency
        if(['invoices','estimates','expenses'].includes(name)) {
          row.language = settings?.language || 'en'; row.occurredAt = row.createdAt; row.pdfColor = true
        }
      }
    }
    value.version = '2.0.0'
  }
  // v2 files predate deletion markers.
  if (!Array.isArray(value.tombstones)) value.tombstones = []
  value.version = BACKUP_VERSION
  validateBackup(value)
  // Quantize legacy floating amounts, as well as externally authored v2 files.
  for(const name of STORES) for(const row of value[name]) Object.assign(row, normalizeRecord(name, row as unknown as Record<string,unknown>, value.preferences.defaultCurrency))
  return value
}
export function normalizeRecord(name: StoreName, source: Record<string,unknown>, defaultCurrency: string): Record<string,unknown> {
  const row = {...source}, currency = (row.currency as string) || defaultCurrency
  if(!validCurrency(currency)) throw new Error('Invalid currency')
  for(const field of numbers[name]) if(['balance','budget','subtotal','tax','total','amount','unitPrice'].includes(field) && typeof row[field] === 'number') row[field] = roundMoney(row[field],currency)
  if(name==='invoices'||name==='estimates') {
    row.items = (row.items as Record<string,unknown>[]).map(item=>({...item,unitPrice:roundMoney(item.unitPrice as number,currency),total:roundMoney((item.quantity as number)*roundMoney(item.unitPrice as number,currency),currency)}))
  }
  return row
}
