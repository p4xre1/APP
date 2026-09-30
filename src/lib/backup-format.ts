import type { FatoratiBackup } from './db'

/**
 * 3.1.0 adds the document template snapshot, the item unit/section/discount fields
 * and the seller identifiers; every one of them is optional, so a 3.0.0 file
 * imports unchanged and a document without a snapshot renders the legacy look.
 *
 * 3.2.0 adds the `notes` store of the notebook. Older files simply have none: the
 * migration writes an empty array and every other record is untouched, so an
 * existing backup still restores exactly the same data.
 */
export const BACKUP_VERSION = '3.2.0'
/** Formats this build can still read. Everything older is migrated up on import. */
export const SUPPORTED_BACKUP_VERSIONS = ['1.0.0', '2.0.0', '3.0.0', '3.1.0', BACKUP_VERSION]
/** Import limits. They bound work before any decrypt or write happens. */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024
export const MAX_RECORDS_PER_STORE = 20_000
export const MAX_ITEMS_PER_DOCUMENT = 500
export const MAX_TEXT_LENGTH = 10_000
export const MAX_ITEM_TEXT_LENGTH = 120
export const MAX_FOOTER_NOTE_LENGTH = 160
export const MAX_TEMPLATE_VERSION = 1_000

/**
 * A stored image has to be a base64 bitmap data URL inside the documented cap.
 * SVG is refused on purpose: it is a document format, not a photo, and nothing in
 * the app ever produces one.
 */
/** Subtypes the app itself produces ('image/png' -> 'png'), so nothing else passes. */
const IMAGE_SUBTYPES = IMAGE_MIME_TYPES.map(type => type.slice('image/'.length))

export function isStoredImage(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const match = /^data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(value)
  if (!match) return false
  const kind = match[1].toLowerCase()
  if (!IMAGE_SUBTYPES.includes(kind)) return false
  const payload = match[2]
  const bytes = Math.floor((payload.length * 3) / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0)
  return bytes <= MAX_BACKUP_IMAGE_BYTES
}

/** Shape of the optional template snapshot, validated field by field. */
export function isTemplateSnapshot(value: unknown): boolean {
  if (!object(value)) return false
  if (!isLayoutId(value.layoutId) || !isPresetId(value.presetId) || !isAccentId(value.accent)) return false
  if (!Number.isInteger(value.templateVersion) || (value.templateVersion as number) < 1 || (value.templateVersion as number) > MAX_TEMPLATE_VERSION) return false
  if (!isTaxRegion(value.region)) return false
  if (value.footerNote !== undefined && (typeof value.footerNote !== 'string' || value.footerNote.length > MAX_FOOTER_NOTE_LENGTH)) return false
  for (const key of ['showLogo', 'showStamp']) if (value[key] !== undefined && typeof value[key] !== 'boolean') return false
  if (value.labels !== undefined) {
    if (!object(value.labels)) return false
    for (const [column, label] of Object.entries(value.labels)) {
      if (!['description', 'unit', 'quantity', 'unitPrice', 'discount', 'total'].includes(column)) return false
      if (typeof label !== 'string' || !label.trim() || label.length > 40) return false
    }
  }
  return true
}
export const MIN_PASSWORD_LENGTH = 8
export const MIN_BACKUP_ITERATIONS = 10_000
export const MAX_BACKUP_ITERATIONS = 5_000_000
import { STORES, type StoreName } from './schema'
import type { TaxRegion } from '../store/types'
export { STORES } from './schema'
export type { StoreName } from './schema'
import { defaultPreferences, validPreferences, validCurrency, languages } from './preferences'
import { roundMoney } from './format'
import { DEFAULT_TAX_REGION, isTaxRegion } from './taxGuide'
import { MAX_BACKUP_IMAGE_BYTES, IMAGE_MIME_TYPES } from './images'
import { isAccentId, isLayoutId, isPresetId, LEGACY_TEMPLATE } from './templates'
import { isSubscriptionCurrency, isSubscriptionCycle, isISODate, MAX_PERIOD_MONTHS, warnDays } from './subscriptions'
import { isNoteColor, isNoteTime, isNoteType, isReminderChoice, MAX_LINK_ID, MAX_NOTE_BODY, MAX_NOTE_TITLE, MAX_TAGS, MAX_TAG_LENGTH } from './notes'
export type ImportMode = 'replace' | 'merge'
export interface ImportSummary { added: number; updated: number; skipped: number }

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
  subscriptions: ['serviceName', 'currency', 'billingCycle', 'startDate'],
  notes: ['body'],
}
const numbers: Record<StoreName, string[]> = {
  businesses: [], customers: ['balance'], projects: ['budget'],
  invoices: ['subtotal', 'tax', 'total'], estimates: ['subtotal', 'tax', 'total'],
  expenses: ['amount'], products: ['unitPrice', 'stock'], settings: ['taxRate'],
  subscriptions: ['amountMinor'],
  notes: [],
}
const enums: Partial<Record<StoreName, Record<string, string[]>>> = {
  projects: { status: ['planning', 'active', 'on_hold', 'done'] },
  invoices: { status: ['draft', 'sent', 'paid', 'overdue'] },
  estimates: { status: ['draft', 'sent', 'accepted', 'declined'] },
  settings: { theme: ['light', 'dark', 'system'], language: [...languages] },
  subscriptions: { currency: ['MAD', 'USD', 'EUR'], billingCycle: ['monthly', 'yearly', 'one_time_period'] },
}

/**
 * A notebook record, field by field. Everything is checked before the import opens a
 * write transaction: an out-of-range reminder, an unknown colour, a time without a
 * date or a tag list over the cap rejects the whole file, so the vault can never
 * receive a note the editor itself would refuse to produce.
 */
function validateNoteRecord(record: Record<string, unknown>): void {
  const invalid = () => new Error('Invalid backup record; no data was changed')
  if ((record.body as string).length > MAX_NOTE_BODY) throw invalid()
  if (!isNoteType(record.type) || typeof record.pinned !== 'boolean' || typeof record.archived !== 'boolean' || typeof record.done !== 'boolean') throw invalid()
  if (record.title !== undefined && (typeof record.title !== 'string' || !record.title.trim() || record.title.length > MAX_NOTE_TITLE)) throw invalid()
  if (record.color !== undefined && !isNoteColor(record.color)) throw invalid()
  if (!Array.isArray(record.tags) || record.tags.length > MAX_TAGS) throw invalid()
  for (const tag of record.tags) {
    if (typeof tag !== 'string' || !tag.trim() || tag.length > MAX_TAG_LENGTH) throw invalid()
  }
  if (record.date !== undefined && !isISODate(record.date)) throw invalid()
  if (record.time !== undefined && (!isNoteTime(record.time) || !isISODate(record.date))) throw invalid()
  if (record.remindMinutesBefore !== undefined && (!isReminderChoice(record.remindMinutesBefore) || !isISODate(record.date))) throw invalid()
  for (const key of ['linkedCustomerId', 'linkedInvoiceId', 'linkedProjectId'] as const) {
    if (record[key] !== undefined && (typeof record[key] !== 'string' || !(record[key] as string).trim() || (record[key] as string).length > MAX_LINK_ID)) throw invalid()
  }
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
    if (records.length > MAX_RECORDS_PER_STORE) throw new Error('Backup contains too many records')
    const ids = new Set<string>()
    for (const record of records) {
      const invalid = () => new Error('Invalid backup record; no data was changed')
      if (!object(record) || typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id)
        || !timestamp(record.createdAt) || !timestamp(record.updatedAt)) throw invalid()
      ids.add(record.id)
      if (strings[name].some(key => typeof record[key] !== 'string' || (record[key] as string).length > MAX_TEXT_LENGTH)
        || numbers[name].some(key => !finite(record[key]))) throw invalid()
      if (record.taxRate !== undefined && !(finite(record.taxRate) && record.taxRate >= 0 && record.taxRate <= 1000)) throw invalid()
      if (record.paidAt !== undefined && !timestamp(record.paidAt)) throw invalid()
      if (record.taxNumber !== undefined && (typeof record.taxNumber !== 'string' || record.taxNumber.length > 64)) throw invalid()
      if (name === 'settings') {
        if (record.templateLayout !== undefined && !isLayoutId(record.templateLayout)) throw invalid()
        if (record.templatePreset !== undefined && !isPresetId(record.templatePreset)) throw invalid()
        if (record.templateAccent !== undefined && !isAccentId(record.templateAccent)) throw invalid()
        if (record.taxRegion !== undefined && !isTaxRegion(record.taxRegion)) throw invalid()
        if (record.taxAssistantRegion !== undefined && !isTaxRegion(record.taxAssistantRegion)) throw invalid()
        for (const key of ['taxAssistantVisible', 'taxAssistantSeen', 'subscriptionReminders', 'subscriptionDayOfReminder', 'subscriptionHideNames']) {
          if (record[key] !== undefined && typeof record[key] !== 'boolean') throw invalid()
        }
        if (record.subscriptionWarnDays !== undefined && warnDays(record.subscriptionWarnDays) !== record.subscriptionWarnDays) throw invalid()
      }
      if (name === 'subscriptions') {
        if (!isSubscriptionCurrency(record.currency) || !isSubscriptionCycle(record.billingCycle)) throw invalid()
        if (!isISODate(record.startDate)) throw invalid()
        if (!Number.isInteger(record.amountMinor) || (record.amountMinor as number) < 0 || (record.amountMinor as number) > 1e15) throw invalid()
        if (typeof record.autoRenew !== 'boolean') throw invalid()
        if (record.periodMonths !== undefined && (!Number.isInteger(record.periodMonths) || (record.periodMonths as number) < 1 || (record.periodMonths as number) > MAX_PERIOD_MONTHS)) throw invalid()
        if (record.cancelledAt !== undefined && !timestamp(record.cancelledAt)) throw invalid()
        for (const key of ['category', 'paymentMethod', 'notes']) {
          if (record[key] !== undefined && typeof record[key] !== 'string') throw invalid()
        }
      }
      for (const [key, choices] of Object.entries(enums[name] || {})) {
        if (!choices.includes(record[key] as string)) throw invalid()
      }
      if (['invoices','estimates','expenses','settings','businesses'].includes(name) && !validCurrency(record.currency)) throw invalid()
      if (['invoices','estimates','expenses'].includes(name)) {
        if (!languages.includes(record.language as typeof languages[number]) || !timestamp(record.occurredAt)) throw invalid()
        if (record.exchangeRate !== undefined && (!finite(record.exchangeRate) || record.exchangeRate <= 0 || !validCurrency(record.rateCurrency))) throw invalid()
        if (record.pdfColor !== undefined && typeof record.pdfColor !== 'boolean') throw invalid()
      }
      if (name === 'businesses') {
        for (const key of ['ifNumber', 'tpNumber', 'rcNumber', 'cnieNumber']) {
          if (record[key] !== undefined && (typeof record[key] !== 'string' || record[key].length > 64)) throw invalid()
        }
        for (const key of ['logo', 'stamp']) if (record[key] !== undefined && !isStoredImage(record[key])) throw invalid()
      }
      if (name === 'notes') validateNoteRecord(record)
      if (name === 'invoices' || name === 'estimates') {
        if (record.template !== undefined && !isTemplateSnapshot(record.template)) throw invalid()
        if (record.paymentMethod !== undefined && (typeof record.paymentMethod !== 'string' || record.paymentMethod.length > MAX_ITEM_TEXT_LENGTH)) throw invalid()
      }
      const optional = name === 'businesses' ? ['city']
        : name === 'expenses' ? ['receipt']
        : name === 'invoices' || name === 'estimates' ? ['projectId'] : []
      if (optional.some(key => record[key] !== undefined && typeof record[key] !== 'string')) throw invalid()
      if (name === 'invoices' || name === 'estimates') {
        if (!Array.isArray(record.items) || record.items.length > MAX_ITEMS_PER_DOCUMENT) throw invalid()
        const itemIds = new Set<string>()
        for (const item of record.items) {
          if (!object(item) || typeof item.id !== 'string' || !item.id.trim() || itemIds.has(item.id)
            || typeof item.description !== 'string'
            || !['quantity', 'unitPrice', 'total'].every(key => finite(item[key]))
            || (item.productId !== undefined && typeof item.productId !== 'string')) throw invalid()
          for (const key of ['unit', 'section']) {
            if (item[key] !== undefined && (typeof item[key] !== 'string' || item[key].length > MAX_ITEM_TEXT_LENGTH)) throw invalid()
          }
          if (item.discount !== undefined && !(finite(item.discount) && item.discount >= 0 && item.discount <= 100)) throw invalid()
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

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0))
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure encryption is not available on this device.')
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

export async function encodeBackup(backup: FatoratiBackup, password = ''): Promise<string> {
  validateBackup(backup)
  const json = JSON.stringify(backup, (key, value) => ['createdAt','updatedAt','occurredAt','exportedAt','paidAt'].includes(key) && typeof value === 'number' ? new Date(value).toISOString() : value)
  if (!password) return json
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error('Backup password is too short')
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
      || !finite(value.iterations) || value.iterations < MIN_BACKUP_ITERATIONS || value.iterations > MAX_BACKUP_ITERATIONS
      || typeof value.salt !== 'string'
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
/** Region a pre-template file was written under: its own settings, else the default. */
function legacyRegion(value: Record<string, unknown>): TaxRegion {
  const settings = Array.isArray(value.settings) ? value.settings[0] : undefined
  const region = object(settings) ? settings.taxRegion : undefined
  return isTaxRegion(region) ? region : DEFAULT_TAX_REGION
}
export function migrateBackup(input: unknown): FatoratiBackup {
  if (!object(input) || !SUPPORTED_BACKUP_VERSIONS.includes(input.version as string)) throw new Error('Unsupported backup version')
  const value = JSON.parse(JSON.stringify(input), (key, item) => {
    if (['createdAt','updatedAt','occurredAt','exportedAt','paidAt'].includes(key) && typeof item === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(item)) return Date.parse(item)
    return item
  }) as Record<string, unknown>
  if(value.version === '1.0.0') {
    for (const name of STORES) if (value[name] === undefined) value[name] = []
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
        if(name === 'invoices' || name === 'estimates') row.taxRate ??= 0
      }
    }
    value.version = '2.0.0'
  }
  // 2.0.0 -> 3.0.0: the subscriptions store is new, so older files simply have none.
  if (value.subscriptions === undefined) (value as Record<string, unknown>).subscriptions = []
  // 3.1.0 -> 3.2.0: same for the notebook; a file with notes keeps them untouched.
  if (value.notes === undefined) (value as Record<string, unknown>).notes = []
  // 3.0.0 -> 3.1.0: a document written before templates existed gets the snapshot it
  // already renders as - classic layout, general preset, template version 1, the app
  // accent, no logo. Writing it down is what stops a later Settings change from moving
  // an old invoice, and it is the only reason the file version is bumped.
  if (value.version !== BACKUP_VERSION) {
    const region = legacyRegion(value)
    for (const name of ['invoices', 'estimates'] as const) {
      for (const row of value[name] as unknown as Record<string, unknown>[]) {
        if (row.template === undefined) row.template = { ...LEGACY_TEMPLATE, labels: { ...LEGACY_TEMPLATE.labels }, region }
      }
    }
    value.version = BACKUP_VERSION
  }
  validateBackup(value)
  // Quantize legacy floating amounts, as well as externally authored v2 files.
  for(const name of STORES) for(const row of value[name]) Object.assign(row, normalizeRecord(name, row as unknown as Record<string,unknown>, value.preferences.defaultCurrency))
  return value
}
export function normalizeRecord(name: StoreName, source: Record<string,unknown>, defaultCurrency: string): Record<string,unknown> {
  const row = {...source}, currency = (row.currency as string) || defaultCurrency
  if(!validCurrency(currency)) throw new Error('Invalid currency')
  for(const field of numbers[name]) if(['balance','budget','subtotal','tax','total','amount','unitPrice'].includes(field) && typeof row[field] === 'number') row[field] = roundMoney(row[field],currency)
  if((name === 'invoices' || name === 'estimates') && row.taxRate !== undefined) {
    const rate = Number(row.taxRate)
    if(!Number.isFinite(rate) || rate < 0 || rate > 1000) throw new Error('Invalid tax rate')
    row.taxRate = Math.round(rate * 1e6) / 1e6
  }
  if(name==='invoices'||name==='estimates') {
    row.items = (row.items as Record<string,unknown>[]).map(item=>({...item,unitPrice:roundMoney(item.unitPrice as number,currency),total:roundMoney((item.quantity as number)*roundMoney(item.unitPrice as number,currency),currency)}))
  }
  // A note holds no amount at all, so there is nothing to quantize for it.
  return row
}
