import { toBase64, fromBase64, deriveKey } from './backup-format'

/** Password-protected CSV/PDF exports use their own container, not the backup format. */
export const EXPORT_EXTENSION = '.fatorati-export'
const ITERATIONS = 600_000
export type ExportKind = 'csv' | 'pdf'

export interface ProtectedExportHeader {
  format: 'fatorati-export'
  version: 1
  algorithm: 'AES-GCM'
  kdf: 'PBKDF2-SHA256'
  iterations: number
  kind: ExportKind
  filename: string
  createdAt: string
  encoding: 'utf8' | 'base64'
  salt: string
  iv: string
  ciphertext: string
}

export class ExportPasswordRequiredError extends Error {
  constructor() { super('This export is encrypted. Enter its password.'); this.name = 'ExportPasswordRequiredError' }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function encodeProtectedExport(payload: string | Uint8Array<ArrayBuffer>, options: { password: string; kind: ExportKind; filename: string }): Promise<string> {
  if (!options.password) throw new Error('Enter a password to protect this export')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(options.password, salt, ITERATIONS)
  const encoding = typeof payload === 'string' ? 'utf8' : 'base64'
  const bytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`fatorati-export:${options.kind}`) }, key, bytes)
  const header: ProtectedExportHeader = {
    format: 'fatorati-export', version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
    kind: options.kind, filename: options.filename.replace(/[^a-zA-Z0-9._-]/g, '_'), createdAt: new Date().toISOString(),
    encoding, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)),
  }
  return JSON.stringify(header)
}

export async function decodeProtectedExport(text: string, password?: string): Promise<{ header: ProtectedExportHeader; payload: string | Uint8Array<ArrayBuffer> }> {
  let value: unknown
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new Error('Invalid export: the file is not valid JSON.') }
  if (!object(value) || value.format !== 'fatorati-export' || value.version !== 1 || value.algorithm !== 'AES-GCM'
    || value.kdf !== 'PBKDF2-SHA256' || !Number.isInteger(value.iterations) || (value.iterations as number) < 100_000
    || (value.iterations as number) > 2_000_000 || !['csv', 'pdf'].includes(value.kind as string)
    || typeof value.filename !== 'string' || !value.filename || typeof value.salt !== 'string'
    || typeof value.iv !== 'string' || typeof value.ciphertext !== 'string'
    || !['utf8', 'base64'].includes(value.encoding as string)) {
    throw new Error('Unsupported or damaged export header.')
  }
  let salt: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>, ciphertext: Uint8Array<ArrayBuffer>
  try {
    salt = fromBase64(value.salt); iv = fromBase64(value.iv); ciphertext = fromBase64(value.ciphertext)
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error()
  } catch { throw new Error('Damaged export header.') }
  if (password === undefined) throw new ExportPasswordRequiredError()
  const key = await deriveKey(password, salt, value.iterations as number)
  let decrypted: ArrayBuffer
  try { decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`fatorati-export:${value.kind}`) }, key, ciphertext) }
  catch { throw new Error('Wrong password or damaged export file.') }
  // ignoreBOM keeps the byte order mark that spreadsheets expect in a CSV.
  return { header: value as unknown as ProtectedExportHeader, payload: value.encoding === 'utf8' ? new TextDecoder('utf-8', { ignoreBOM: true }).decode(decrypted) : new Uint8Array(decrypted) }
}
