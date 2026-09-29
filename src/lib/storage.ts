import { STORES, type StoreName } from './schema'
import type { DisplayPreferences } from './preferences'
/** Pending "reset app" request made from the lock screen. */
export interface ResetRequest { requestedAt: number; monotonicAt: number }
export interface CipherRecord { id: string; encrypted: 1; iv: string; ciphertext: string }
export interface PlainRecord { id: string; createdAt: number; updatedAt: number; [field: string]: unknown }
export interface VaultMeta {
  id: 'security'; revision: number; salt?: string; verifier?: string; keyId?: string
  failures: number; blockedUntil: number; biometric: boolean
  /** PBKDF2 cost of the stored verifier; raised in place when the target grows. */
  iterations?: number
  secretKind?: 'pin' | 'passcode'
  /** Highest wall clock ever observed; stops a rewound phone clock from skipping waits. */
  clockFloor?: number
  resetRequest?: ResetRequest
  pendingPreferences?: DisplayPreferences
}
export interface Snapshot { meta: VaultMeta; stores: Record<StoreName, (CipherRecord | PlainRecord)[]> }
export const emptyMeta = (): VaultMeta => ({ id:'security', revision:0, failures:0, blockedUntil:0, biometric:false })
export async function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    let blocked = false
    const request = indexedDB.open('fatorati-offline-v1', 4)
    request.onerror = () => reject(new Error('Storage unavailable'))
    request.onblocked = () => { blocked = true; reject(new Error('Close other app windows')) }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('vault')) db.createObjectStore('vault', {keyPath:'id'})
      for (const name of STORES) {
        const store = db.objectStoreNames.contains(name) ? request.transaction!.objectStore(name) : db.createObjectStore(name,{keyPath:'id'})
        // Whole records are encrypted, so no plaintext field indexes may remain.
        for (const index of Array.from(store.indexNames)) store.deleteIndex(index)
      }
    }
    request.onsuccess = () => { if(blocked){request.result.close();return} request.result.onversionchange = () => request.result.close(); resolve(request.result) }
  })
}
export async function readSnapshot(): Promise<Snapshot> {
  const db = await openStorage()
  return new Promise((resolve,reject) => {
    const tx = db.transaction([...STORES,'vault'],'readonly')
    const snapshot = { meta: emptyMeta(), stores: {} } as Snapshot
    const meta = tx.objectStore('vault').get('security')
    meta.onsuccess = () => { snapshot.meta = meta.result || emptyMeta() }
    for (const name of STORES) { const r = tx.objectStore(name).getAll(); r.onsuccess = () => { snapshot.stores[name] = r.result } }
    tx.oncomplete = () => { db.close(); resolve(snapshot) }
    tx.onabort = () => { db.close(); reject(new Error('Storage unavailable')) }
  })
}
export async function readMeta(): Promise<VaultMeta> {
  const db = await openStorage()
  return new Promise((resolve,reject) => {
    const tx = db.transaction('vault','readonly'); const r = tx.objectStore('vault').get('security')
    tx.oncomplete = () => { db.close(); resolve(r.result || emptyMeta()) }
    tx.onabort = () => { db.close(); reject(new Error('Storage unavailable')) }
  })
}
/** Crypto happens BEFORE the transaction. Revision CAS prevents lost writes across WebViews. */
export async function commit(expected: number, meta: VaultMeta, stores?: Partial<Snapshot['stores']>, guard = () => {}): Promise<void> {
  const db = await openStorage()
  return new Promise((resolve,reject) => {
    const tx = db.transaction([...STORES,'vault'],'readwrite',{durability:'strict'})
    let failure = 'Transaction failed; no data was changed'
    const check = tx.objectStore('vault').get('security')
    check.onsuccess = () => {
      try {
        guard()
        if ((check.result?.revision || 0) !== expected) { failure = 'Data changed; please try again'; tx.abort(); return }
        if (stores) for (const name of STORES) {
          const records = stores[name]
          if (!records) continue
          const store = tx.objectStore(name); store.clear()
          for (const record of records) store.add(record)
        }
        tx.objectStore('vault').put({...meta, revision:expected+1})
      } catch { tx.abort() }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(new Error(failure)) }
  })
}
let queue = Promise.resolve()
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn)
  queue = result.then(() => {}, () => {})
  return result
}
