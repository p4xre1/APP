import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { createOrChangePin, unlockPin, lockVault, isUnlocked, lockDelay, readMeta } from '../src/lib/vault'
import { readSnapshot, commit } from '../src/lib/storage'
import { importBackup, exportBackup, getAll, downloadBackupFile } from '../src/lib/db'
import { decodeBackup, encodeBackup, migrateBackup, STORES, RECORD_STORES } from '../src/lib/backup-format'
import { fixture } from './fixtures'

beforeEach(()=>{lockVault();globalThis.indexedDB=new IDBFactory()})
const withTombstone=()=>{const source=fixture();source.tombstones=[{id:'gone',store:'customers',deletedAt:300,createdAt:300,updatedAt:300}];return source}

test('locked reads are blocked; whole records are encrypted with fresh IVs and no plaintext PIN',async()=>{
  await assert.rejects(getAll('customers'),/locked/)
  await createOrChangePin('482915');await importBackup(withTombstone(),'replace')
  const raw=await readSnapshot(),text=JSON.stringify(raw)
  assert.ok(!text.includes('Café'));assert.ok(!text.includes('482915'));assert.ok(!text.includes('description'))
  // Ids are primary keys, but the store and deletion time stay inside the ciphertext.
  assert.ok(text.includes('"id":"gone"'));assert.ok(!text.includes('"store":"customers"'));assert.ok(!text.includes('"deletedAt"'))
  assert.ok(raw.meta.salt&&raw.meta.verifier)
  const ivs=STORES.map(name=>(raw.stores[name][0] as {iv:string}).iv)
  assert.equal(new Set(ivs).size,RECORD_STORES.length+1)
  lockVault();assert.equal(isUnlocked(),false);await assert.rejects(exportBackup(),/locked/)
  await unlockPin('482915');assert.equal((await exportBackup()).customers[0].name,'عميل André')
})

test('changing PIN atomically re-encrypts every store; old PIN cannot unlock',async()=>{
  await createOrChangePin('482915');await importBackup(withTombstone(),'replace')
  const before=await readSnapshot()
  await createOrChangePin('739184','482915')
  const after=await readSnapshot()
  assert.notEqual(before.meta.salt,after.meta.salt);assert.notEqual(before.meta.keyId,after.meta.keyId)
  for(const name of STORES)assert.notDeepEqual(before.stores[name],after.stores[name])
  lockVault();await assert.rejects(unlockPin('482915'),/Incorrect/)
  await unlockPin('739184');assert.equal((await exportBackup()).invoices[0].total,20)
})

test('late-store PIN rotation failure restores old ciphertext AND old verifier',async()=>{
  await createOrChangePin('482915');await importBackup(fixture(),'replace')
  const before=await readSnapshot(),original=IDBObjectStore.prototype.add
  IDBObjectStore.prototype.add=function(...args){const result=original.apply(this,args);if(this.name==='settings')original.apply(this,args);return result}
  try{await assert.rejects(createOrChangePin('739184','482915'),/no data was changed/)}finally{IDBObjectStore.prototype.add=original}
  assert.deepEqual(await readSnapshot(),before)
  lockVault();await unlockPin('482915');assert.equal((await exportBackup()).products.length,1)
})

test('lockout persists across sessions; delays increase without erasing data',async()=>{
  await createOrChangePin('482915');await importBackup(fixture(),'replace');lockVault()
  for(let attempt=0;attempt<5;attempt++)await assert.rejects(unlockPin('000000'),/Incorrect/)
  const meta=await readMeta();assert.equal(meta.failures,5);assert.ok(meta.blockedUntil>Date.now())
  await assert.rejects(unlockPin('482915'),/please wait/)
  assert.equal((await readSnapshot()).stores.customers.length,1)
  assert.deepEqual([4,5,6,7,8].map(lockDelay),[0,30000,60000,300000,900000])
})

test('record ID/store are authenticated; tampered ciphertext never renders',async()=>{
  await createOrChangePin('482915');await importBackup(fixture(),'replace')
  const raw=await readSnapshot(),customer=raw.stores.customers[0]
  await commit(raw.meta.revision,raw.meta,{customers:[{...customer,id:'other-id'}]})
  await assert.rejects(getAll('customers'),/damaged/)
})

test('old v1 backup migrates currency, language, preferences and UTC timestamps',async()=>{
  const old=JSON.parse(JSON.stringify(fixture()))
  old.version='1.0.0';delete old.preferences;delete old.security
  for(const name of ['businesses','invoices','estimates','expenses'])for(const row of old[name]){delete row.currency;delete row.language;delete row.occurredAt;delete row.pdfColor}
  const next=migrateBackup(old)
  assert.equal(next.version,'3.0.0');assert.equal(next.preferences.defaultCurrency,'EUR')
  assert.equal(next.invoices[0].currency,'EUR');assert.equal(next.expenses[0].occurredAt,100)
  assert.equal(next.security.biometricEnabled,false)
  await createOrChangePin('482915');await importBackup(next,'replace');assert.equal((await exportBackup()).invoices.length,1)
})

test('encrypted backup round-trip between independent installs with different PINs',async()=>{
  await createOrChangePin('482915');await importBackup(fixture(),'replace')
  const first=await exportBackup(),file=await encodeBackup(first,'transfer password')
  lockVault();globalThis.indexedDB=new IDBFactory();await createOrChangePin('918273')
  const incoming=await decodeBackup(file,'transfer password')
  assert.deepEqual(await importBackup(incoming,'replace'),{added:8,updated:0,deleted:0,skipped:0})
  const second=await exportBackup()
  for(const name of STORES)assert.deepEqual(second[name],first[name])
  lockVault();await assert.rejects(unlockPin('482915'),/Incorrect/);await unlockPin('918273')
  await assert.rejects(downloadBackupFile(second,''),/password is required/)
})

test('portable v2 JSON timestamps are ISO 8601, while internal timestamps remain milliseconds',async()=>{
  const data=JSON.parse(await encodeBackup(fixture()))
  assert.equal(data.exportedAt,'1970-01-01T00:00:00.300Z')
  assert.equal(data.invoices[0].createdAt,'1970-01-01T00:00:00.100Z')
  assert.equal((await decodeBackup(JSON.stringify(data))).invoices[0].createdAt,100)
})


test('first PIN preserves installed legacy currency; Arabic and Persian PIN digits normalize consistently',async()=>{
  const original=await readSnapshot()
  const legacySettings={...fixture().settings[0],currency:'KWD'}
  await commit(original.meta.revision,original.meta,{settings:[legacySettings]})
  await createOrChangePin('٤٨٢٩١٥')
  const encrypted=await readSnapshot()
  assert.equal(encrypted.meta.pendingPreferences?.defaultCurrency,'KWD')
  assert.equal('encrypted' in encrypted.stores.settings[0],true)
  assert.equal(JSON.stringify(encrypted.stores.settings).includes('currency'),false)
  lockVault();await unlockPin('۴۸۲۹۱۵')
  assert.equal((await getAll<{currency:string}>('settings'))[0].currency,'KWD')
  lockVault();await unlockPin('482915')
  assert.equal(isUnlocked(),true)
})
