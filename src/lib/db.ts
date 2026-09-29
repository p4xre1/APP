import type { Business, Customer, Project, Invoice, Estimate, Expense, Product, Settings } from '../store/types'
export type { Business, Customer, Project, Invoice, InvoiceItem, Estimate, Expense, Product, Settings } from '../store/types'
import { BACKUP_VERSION, migrateBackup, normalizeRecord, encodeBackup, decodeBackup } from './backup-format'
import type { ImportMode, ImportSummary } from './backup-format'
import { STORES, type StoreName } from './schema'
import { commit, exclusive, type PlainRecord, type Snapshot } from './storage'
import { unlockedSnapshot, encryptRecord, sessionGuard, isUnlocked, readMeta } from './vault'
import { shareFile } from './share-file'
import { Preferences } from '@capacitor/preferences'
import { getPreferences, savePreferences, type DisplayPreferences } from './preferences'

export interface FatoratiBackup {
  version: string; exportedAt: number; preferences: DisplayPreferences
  security: { appLock: true; biometricEnabled: boolean }
  businesses: Business[]; customers: Customer[]; projects: Project[]; invoices: Invoice[]
  estimates: Estimate[]; expenses: Expense[]; products: Product[]; settings: Settings[]
}
export async function getAll<T>(name: StoreName): Promise<T[]> { return (await unlockedSnapshot()).stores[name] as unknown as T[] }
export async function getById<T>(name: StoreName,id:string): Promise<T | undefined> { return (await getAll<PlainRecord>(name)).find(row=>row.id===id) as T | undefined }
function normalize(name:StoreName, source:Record<string,unknown>) {
  const prefs=getPreferences(), row={...source}
  if(['businesses','invoices','estimates','expenses'].includes(name)) row.currency ||= prefs.defaultCurrency
  if(['invoices','estimates','expenses'].includes(name)) {
    row.language ||= prefs.language; row.occurredAt ||= row.createdAt; row.pdfColor ??= prefs.pdfColor
  }
  if(row.exchangeRate !== undefined && (typeof row.exchangeRate !== 'number' || !Number.isFinite(row.exchangeRate) || row.exchangeRate <= 0)) throw new Error('Invalid amount')
  return normalizeRecord(name,row,prefs.defaultCurrency) as PlainRecord
}
export const add = <T extends {id:string;createdAt:number;updatedAt:number}>(name:StoreName,item:Omit<T,'id'|'createdAt'|'updatedAt'> & {id?:string}):Promise<T> => exclusive(async()=>{
  const guard=sessionGuard(), snapshot=await unlockedSnapshot(), now=Date.now()
  const row=normalize(name,{...item,id:item.id||generateId(),createdAt:now,updatedAt:now})
  if(snapshot.stores[name].some(item=>item.id===row.id)) throw new Error('Duplicate record')
  const records=await Promise.all([...snapshot.stores[name],row].map(item=>encryptRecord(name,item)))
  await commit(snapshot.meta.revision,snapshot.meta,{[name]:records},guard)
  return row as unknown as T
})
export const update = <T extends {id:string;updatedAt:number}>(name:StoreName,id:string,patch:Partial<Omit<T,'id'|'createdAt'>>):Promise<T> => exclusive(async()=>{
  const guard=sessionGuard(),snapshot=await unlockedSnapshot(),existing=snapshot.stores[name].find(item=>item.id===id)
  if(!existing) throw new Error('Record not found')
  const row=normalize(name,{...existing,...patch,id,createdAt:existing.createdAt,updatedAt:Date.now()})
  const records=await Promise.all(snapshot.stores[name].map(item=>encryptRecord(name,item.id===id?row:item)))
  await commit(snapshot.meta.revision,snapshot.meta,{[name]:records},guard)
  return row as unknown as T
})
export const remove = (name:StoreName,id:string) => exclusive(async()=>{
  const guard=sessionGuard(),snapshot=await unlockedSnapshot()
  const records=await Promise.all(snapshot.stores[name].filter(item=>item.id!==id).map(item=>encryptRecord(name,item)))
  await commit(snapshot.meta.revision,snapshot.meta,{[name]:records},guard)
})
export const clear = (name:StoreName) => exclusive(async()=>{
  const guard=sessionGuard(),snapshot=await unlockedSnapshot()
  await commit(snapshot.meta.revision,snapshot.meta,{[name]:[]},guard)
})
export const generateId = () => crypto.randomUUID()
export async function exportBackup():Promise<FatoratiBackup> {
  const snapshot=await unlockedSnapshot()
  // Old installed databases gain per-document currency/language on export as well.
  const source = {security:{appLock:true,biometricEnabled:snapshot.meta.biometric},version:BACKUP_VERSION,exportedAt:Date.now(),preferences:getPreferences(),...snapshot.stores}
  for(const name of STORES) source[name]=source[name].map(row=>normalize(name,row))
  return migrateBackup(source)
}
export const importBackup = (input:FatoratiBackup,mode:ImportMode):Promise<ImportSummary> => exclusive(async()=>{
  const backup=migrateBackup(input) // Full validation, before any writes.
  if(mode!=='merge'&&mode!=='replace') throw new Error('Choose Replace or Merge')
  const guard=sessionGuard(),snapshot=await unlockedSnapshot(),summary={added:0,updated:0,skipped:0}
  const encrypted={} as Snapshot['stores']
  for(const name of STORES) {
    const records=new Map((mode==='merge'?snapshot.stores[name]:[]).map(item=>[item.id,item]))
    for(const incoming of backup[name]) {
      const existing=records.get(incoming.id)
      if(!existing){records.set(incoming.id,incoming as unknown as PlainRecord);summary.added++}
      else if(incoming.updatedAt>existing.updatedAt){records.set(incoming.id,incoming as unknown as PlainRecord);summary.updated++}
      else summary.skipped++
    }
    encrypted[name]=await Promise.all([...records.values()].map(item=>encryptRecord(name,item)))
  }
  const prefs=mode==='replace'||backup.preferences.updatedAt>getPreferences().updatedAt ? backup.preferences : getPreferences()
  // Persist display preferences in the same transaction; mirror to Capacitor on next unlock.
  await commit(snapshot.meta.revision,{...snapshot.meta,pendingPreferences:prefs},encrypted,guard)
  return summary
})
export const applyImportedPreferences = () => exclusive(async () => {
  const guard=sessionGuard(), meta=await readMeta()
  if(meta.pendingPreferences) {
    await savePreferences(meta.pendingPreferences)
    const next={...meta}; delete next.pendingPreferences
    await commit(meta.revision,next,undefined,guard)
  }
})
export const LAST_BACKUP_KEY='fatorati.lastBackupAt'
export async function getLastBackupDate():Promise<number|null> {
  const {value}=await Preferences.get({key:LAST_BACKUP_KEY}),date=Number(value)
  return value&&Number.isFinite(date)&&date>0&&date<=8.64e15?date:null
}
export async function downloadBackupFile(backup:FatoratiBackup,password=''):Promise<void> {
  if(!isUnlocked()) throw new Error('App locked')
  if(!password) throw new Error('A backup password is required while app lock is enabled')
  const guard=sessionGuard(),json=await encodeBackup(backup,password);guard()
  await shareFile(`fatorati-backup-${new Date().toISOString().slice(0,10)}.fatorati`,json,'application/json')
  await Preferences.set({key:LAST_BACKUP_KEY,value:String(Date.now())})
  window.dispatchEvent(new Event('fatorati:backup'))
}
export async function loadBackupFile(file:File,password?:string) { return decodeBackup(await file.text(),password) }
export async function isOnboardingCompleted(){return (await getAll<Business>('businesses')).length>0}
export async function getBusiness(){return (await getAll<Business>('businesses'))[0]||null}
