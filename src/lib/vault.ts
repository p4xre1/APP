import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { NativeBiometric } from '@capgo/capacitor-native-biometric'
import { Preferences } from '@capacitor/preferences'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { readSnapshot, readMeta, commit, exclusive, emptyMeta, type VaultMeta, type PlainRecord, type CipherRecord, type Snapshot } from './storage'
import { STORES, type StoreName } from './schema'
import { t } from '../i18n'
import { getPreferences, validCurrency } from './preferences'
import { clearExportCache } from './cache'

const ITERATIONS = 600_000
const server = 'com.fatorati.app.vault' // Local keystore alias, not a network endpoint.
export const b64 = (bytes: Uint8Array) => {
  let text = ''; for (let i=0;i<bytes.length;i+=8192) text += String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(text)
}
export const unb64 = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(value), c => c.charCodeAt(0))
let session: { key: CryptoKey; raw: Uint8Array<ArrayBuffer>; keyId: string } | null = null
let epoch = 0
const listeners = new Set<() => void>()
export const isUnlocked = () => !!session
export const subscribeLock = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/**
 * Decrypted working set for the current unlock session. IndexedDB is still the only
 * source of truth: the cache is dropped on lock, and every commit still checks the
 * stored revision, so a stale cache can never overwrite newer data from another WebView.
 */
interface SessionCache {
  keyId: string
  meta: VaultMeta
  raw: Record<StoreName, CipherRecord[]>
  plain: Record<StoreName, PlainRecord[]>
}
let cache: SessionCache | null = null
export function dropCache() { cache = null }
export function cachedStore(name: StoreName) { return cache ? { raw: cache.raw[name], plain: cache.plain[name] } : undefined }
/** Keeps the cache in step with a successful commit without re-reading or re-decrypting. */
export function cacheAfterCommit(meta: VaultMeta, revision: number, changes?: Partial<Record<StoreName, { raw: CipherRecord[]; plain: PlainRecord[] }>>) {
  if (!cache) return
  if (changes) for (const name of STORES) {
    const change = changes[name]
    if (change) { cache.raw[name] = change.raw; cache.plain[name] = change.plain }
  }
  cache.meta = { ...meta, revision }
}

export function lockVault() {
  session?.raw.fill(0); session = null; epoch++; dropCache(); listeners.forEach(fn => fn())
}
export function sessionGuard() { const initial = epoch; if (!session) throw new Error('App locked'); return () => { if (!session || epoch !== initial) throw new Error('App locked') } }
async function aes(raw: Uint8Array<ArrayBuffer>) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']) }
export const normalizePin = (value: string) => value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0))
/** Installs made before the cost was stored always used the current target. */
const storedIterations = (meta: VaultMeta) => Number.isInteger(meta.iterations) && (meta.iterations as number) > 0 ? Math.min(meta.iterations as number, 5_000_000) : ITERATIONS
async function pinMaterial(pin: string, salt: string, iterations = ITERATIONS) {
  pin = normalizePin(pin)
  if (!/^[0-9]{6}$/.test(pin)) throw new Error('Enter a 6-digit PIN')
  const base = await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits'])
  const bytes = new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations,hash:'SHA-256'},base,512))
  const raw = bytes.slice(0,32), verifier = b64(bytes.slice(32)); bytes.fill(0)
  return { raw, verifier, key: await aes(raw) }
}
function equal(a:string,b:string) { if(a.length!==b.length)return false; let diff=0;for(let i=0;i<a.length;i++)diff |= a.charCodeAt(i)^b.charCodeAt(i);return diff===0 }
export function lockDelay(failures: number) { return failures < 5 ? 0 : [30_000,60_000,300_000,900_000,3600_000][Math.min(failures-5,4)] }
/**
 * Verifies a PIN. `countFailure` is false while an authenticated session is
 * already unlocked (changing the PIN, enabling biometrics), so a mistyped
 * "current PIN" inside Settings cannot lock the user out of their own app.
 */
async function checkPin(pin: string, meta: VaultMeta, countFailure = true) {
  if (Date.now() < meta.blockedUntil) throw new Error('Too many attempts; please wait')
  if (!meta.salt || !meta.verifier) throw new Error('Create your PIN')
  const material = await pinMaterial(pin,meta.salt,storedIterations(meta))
  if (!equal(material.verifier,meta.verifier)) {
    material.raw.fill(0)
    if (!countFailure) throw new Error('Incorrect PIN')
    const failures = meta.failures+1
    await commit(meta.revision,{...meta, failures, blockedUntil:Date.now()+lockDelay(failures)})
    throw new Error('Incorrect PIN')
  }
  return material
}
export async function encryptRecord(store: StoreName, record: PlainRecord, key = session?.key): Promise<CipherRecord> {
  if (!key) throw new Error('App locked')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(`${store}:${record.id}`)},key,new TextEncoder().encode(JSON.stringify(record)))
  return {id:record.id,encrypted:1,iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext))}
}
export async function decryptRecord(store: StoreName, record: CipherRecord | PlainRecord, key = session?.key): Promise<PlainRecord> {
  if (!key) throw new Error('App locked')
  if (!('encrypted' in record)) return record as PlainRecord // Only accepted during first PIN migration.
  const cipher = record as CipherRecord
  try {
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(cipher.iv),additionalData:new TextEncoder().encode(`${store}:${record.id}`)},key,unb64(cipher.ciphertext))
    const data: PlainRecord = JSON.parse(new TextDecoder().decode(plain))
    if(data.id!==record.id) throw new Error()
    return data
  } catch { throw new Error('Encrypted data is damaged or inaccessible') }
}
export interface UnlockedSnapshot { meta: VaultMeta; stores: Record<StoreName, PlainRecord[]> }
/** Decrypts every store once per unlock, then serves the session cache. */
export async function unlockedSnapshot(): Promise<UnlockedSnapshot> {
  const guard = sessionGuard()
  if (cache && session && cache.keyId === session.keyId) { guard(); return { meta: cache.meta, stores: cache.plain } }
  const snapshot = await readSnapshot()
  if (snapshot.meta.keyId !== session?.keyId) { lockVault(); throw new Error('App locked') }
  const stores = {} as Record<StoreName,PlainRecord[]>, raw = {} as Record<StoreName,CipherRecord[]>
  for(const name of STORES) {
    if(snapshot.stores[name].some(row => !('encrypted' in row))) throw new Error('Encrypted data is damaged or inaccessible')
    raw[name] = snapshot.stores[name] as CipherRecord[]
    stores[name] = await Promise.all(raw[name].map(row => decryptRecord(name,row)))
  }
  guard()
  cache = { keyId: session!.keyId, meta: snapshot.meta, raw, plain: stores }
  return { meta: snapshot.meta, stores }
}
export const unlockPin = (pin: string) => exclusive(async () => {
  const start = epoch, meta = await readMeta(), material = await checkPin(pin,meta)
  if(start!==epoch) {material.raw.fill(0); throw new Error('App locked')}
  await commit(meta.revision,{...meta,failures:0,blockedUntil:0},undefined,()=>{if(start!==epoch)throw new Error('App locked')})
  if(start!==epoch) {material.raw.fill(0);throw new Error('App locked')}
  dropCache() // A fresh unlock must read the current database, not an older session's view.
  session = {key:material.key,raw:material.raw,keyId:meta.keyId!}; epoch++; listeners.forEach(fn=>fn())
  // Staged plaintext exports are removed once the user is back in the app.
  void clearExportCache()
})
export const createOrChangePin = (pin: string, oldPin?: string) => exclusive(async () => {
  const start = epoch, snapshot = await readSnapshot(), old = snapshot.meta
  let oldKey: CryptoKey | undefined
  if(old.salt) {const verified=await checkPin(oldPin||'',old,false);oldKey=verified.key;verified.raw.fill(0)}
  const salt = b64(crypto.getRandomValues(new Uint8Array(16))), material = await pinMaterial(pin,salt)
  const meta: VaultMeta = {...old,salt,verifier:material.verifier,iterations:ITERATIONS,keyId:crypto.randomUUID(),failures:0,blockedUntil:0,biometric:false}
  if(!old.salt && snapshot.stores.settings.length) {
    const legacyCurrency=(snapshot.stores.settings[0] as PlainRecord).currency
    if(validCurrency(legacyCurrency))meta.pendingPreferences={...getPreferences(),defaultCurrency:legacyCurrency,updatedAt:Date.now()}
  }
  const stores = {} as Snapshot['stores']
  for(const name of STORES) {
    const rows = old.salt ? await Promise.all(snapshot.stores[name].map(row=>decryptRecord(name,row,oldKey))) : snapshot.stores[name] as PlainRecord[]
    stores[name] = await Promise.all(rows.map(row=>encryptRecord(name,row,material.key)))
  }
  try { await commit(old.revision,meta,stores,()=>{if(start!==epoch)throw new Error('App locked')}) }
  catch(error) { material.raw.fill(0); throw error }
  if(start!==epoch) {material.raw.fill(0);throw new Error('App locked')}
  dropCache()
  session?.raw.fill(0); session={key:material.key,raw:material.raw,keyId:meta.keyId!};epoch++
  listeners.forEach(fn=>fn())
  // Old biometric material cannot unlock the new keyId, even if native deletion fails.
  if(Capacitor.isNativePlatform()) await NativeBiometric.deleteCredentials({server}).catch(()=>{})
})
export const biometricAvailable = async () => Capacitor.isNativePlatform() && (await NativeBiometric.isAvailable({useFallback:false})).isAvailable
export const enableBiometric = (pin:string, enabled:boolean) => exclusive(async () => {
  const guard=sessionGuard(),meta=await readMeta(),material=await checkPin(pin,meta,false)
  let authorizedEpoch=epoch
  try {
    if(enabled) {
      if(!await biometricAvailable()) throw new Error('Biometrics unavailable')
      await NativeBiometric.verifyIdentity({title:t('Unlock Fatorati'),reason:t('Use biometrics'),negativeButtonText:t('Cancel'),useFallback:false})
      if (!(await NativeApp.getState()).isActive) throw new Error('App locked')
      if ((await readMeta()).keyId !== meta.keyId) throw new Error('App locked')
      authorizedEpoch=epoch
      await NativeBiometric.setCredentials({server,username:meta.keyId!,password:b64(material.raw)})
    } else await NativeBiometric.deleteCredentials({server})
    await commit(meta.revision,{...meta,biometric:enabled},undefined,()=>{
      if(enabled && epoch!==authorizedEpoch)throw new Error('App locked')
      if(!enabled) guard()
    })
    cacheAfterCommit(meta,meta.revision+1)
    if(enabled && epoch===authorizedEpoch) {
      session={key:material.key,raw:material.raw.slice(),keyId:meta.keyId!}
      dropCache()
      epoch++;listeners.forEach(fn=>fn())
    }
  } finally {material.raw.fill(0)}
})
export const unlockBiometric = () => exclusive(async () => {
  const meta=await readMeta()
  if(!meta.biometric || Date.now()<meta.blockedUntil) throw new Error('Use your PIN')
  try {
    await NativeBiometric.verifyIdentity({title:t('Unlock Fatorati'),reason:t('Use biometrics'),negativeButtonText:t('Use your PIN'),useFallback:false})
    const credentials=await NativeBiometric.getCredentials({server})
    if(credentials.username!==meta.keyId || !(await NativeApp.getState()).isActive) throw new Error('Use your PIN')
    const authorizedEpoch=epoch,raw=unb64(credentials.password),key=await aes(raw)
    if(epoch!==authorizedEpoch){raw.fill(0);throw new Error('App locked')}
    dropCache()
    session={raw,key,keyId:meta.keyId!}
    await unlockedSnapshot() // Verify decryption before revealing UI.
    listeners.forEach(fn=>fn())
    void clearExportCache()
  } catch { lockVault(); throw new Error('Use your PIN') }
})
/** Explicit destructive reset only; never invoked by lockout. */
export const resetApp = () => exclusive(async () => {
  lockVault()
  if(Capacitor.isNativePlatform()) {
    // Native cleanup is best effort: a failing plugin must never leave the vault untouched.
    try { await NativeBiometric.deleteCredentials({server}) } catch { /* Nothing enrolled. */ }
    try { await clearExportCache() } catch { /* Nothing staged. */ }
    try {
      const entries = await Filesystem.readdir({path:'',directory:Directory.Cache})
      if(entries.files.some(file=>file.name==='exports')) await Filesystem.rmdir({path:'exports',directory:Directory.Cache,recursive:true})
    } catch { /* Cache already empty. */ }
  }
  const snapshot=await readSnapshot(),stores={} as Snapshot['stores']
  for(const name of STORES) stores[name]=[]
  await commit(snapshot.meta.revision,emptyMeta(),stores)
  dropCache()
  // Preference cleanup is best effort too: the records above are already gone.
  try { await Preferences.clear() } catch { /* Non-secret display settings only. */ }
  try { if(typeof localStorage!=='undefined') localStorage.clear() } catch { /* Mirrored appearance only. */ }
})
export { readMeta }
