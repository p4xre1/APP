import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultPreferences, accentText, validPreferences, supportedValues, migratePreferences } from '../src/lib/preferences'
import { minorUnits, roundMoney, sumMoney, formatDate, inputToUTC } from '../src/lib/format'
import { reportTotals } from '../src/lib/reports'
import { fixture } from './fixtures'
import en from '../src/i18n/en.json'
import ar from '../src/i18n/ar.json'
import fr from '../src/i18n/fr.json'
import es from '../src/i18n/es.json'
import pt from '../src/i18n/pt.json'

test('all five dictionaries have identical keys and interpolation tokens',()=>{
  const entries=Object.entries(en)
  for(const dictionary of [ar,fr,es,pt]){
    assert.deepEqual(Object.keys(dictionary).sort(),Object.keys(en).sort())
    for(const [key,value] of entries){const other=dictionary[key as keyof typeof en];assert.ok(other.trim());assert.deepEqual(other.match(/\{\w+\}/g)?.sort(),value.match(/\{\w+\}/g)?.sort(),key)}
  }
})
test('rounding respects JPY 0, USD 2, KWD 3 and safe sums',()=>{
  assert.equal(minorUnits('12.8','JPY'),13);assert.equal(roundMoney(1.2345,'KWD'),1.235)
  assert.equal(minorUnits('1.005','USD'),101);assert.equal(minorUnits('-1.005','USD'),-101)
  assert.equal(sumMoney([.1,.2],'USD'),.3)
  assert.throws(()=>minorUnits(Number.MAX_SAFE_INTEGER,'USD'),/large/)
  assert.ok(supportedValues('currency').length>150)
})
test('mixed currencies never add together; conversion uses explicit target-currency rates only',()=>{
  const source=fixture(),a={...source.invoices[0],currency:'JPY',total:1000,exchangeRate:.007,rateCurrency:'USD'},b={...source.invoices[0],currency:'KWD',total:3}
  const result=reportTotals([a,b],[],'USD')
  assert.equal(result.totals.length,2);assert.equal(result.converted,7);assert.equal(result.missing,1)
  assert.equal(reportTotals([a],[],'EUR').missing,1)
})
test('12/24 hour, time zone, calendar date stability, Hijri and Arabic-Indic digits',()=>{
  const time=Date.UTC(2026,8,29,17,5),p={...defaultPreferences,timeZone:'UTC'}
  assert.match(formatDate(time,true,'en',{...p,timeFormat:'12h'}),/5:05 PM/)
  assert.match(formatDate(time,true,'en',{...p,timeFormat:'24h'}),/17:05/)
  assert.match(formatDate(time,true,'ar',{...p,digits:'arab',hijri:true}),/[٠-٩]/)
  assert.equal(formatDate('2026-09-29',false,'en',{...p,timeZone:'Pacific/Honolulu',dateFormat:'YYYY-MM-DD'}),'2026-09-29')
  assert.equal(inputToUTC('2026-09-29T17:05','UTC'),time)
  assert.throws(()=>inputToUTC('2026-03-08T02:30','America/New_York'),/Invalid/)
})
test('accent text automatically chooses the higher-contrast black/white; preferences reject malformed values',()=>{
  assert.equal(accentText('#ffffff'),'#000000');assert.equal(accentText('#000000'),'#ffffff')
  assert.equal(accentText('#ffff00'),'#000000');assert.equal(accentText('#2563eb'),'#ffffff')
  assert.equal(validPreferences(defaultPreferences),true)
  for(const patch of [{accent:'javascript:x'},{timeZone:'wrong/zone'},{autoLock:100},{digits:'no'},{defaultCurrency:'BAD'}])assert.equal(validPreferences({...defaultPreferences,...patch}),false)
})
test('older saved preferences discard retired menu styles and preserve supported choices',()=>{
  const legacy={...defaultPreferences,theme:'dark' as const,accent:'#7c3aed',sidebarColor:'#fefefe',brandFont:'sora'}
  const migrated=migratePreferences(legacy)
  assert.ok(migrated)
  assert.equal(migrated.theme,'dark')
  assert.equal(migrated.accent,'#7c3aed')
  assert.equal('sidebarColor' in migrated,false)
  assert.equal('brandFont' in migrated,false)
})
