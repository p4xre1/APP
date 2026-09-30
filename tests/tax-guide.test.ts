import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { IDBFactory } from 'fake-indexeddb'
import {
  TAX_GUIDE, TAX_FIELD_HINTS, TAX_DISCLAIMER, TAX_REGION_LABEL, TAX_REGIONS, TAX_GUIDE_LAST_REVIEWED,
  assistantRegion, assistantStartsOpen, assistantVisible, guideFor, hintsFor, isTaxRegion, settingsRegion,
} from '../src/lib/taxGuide'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { validateBackup } from '../src/lib/backup-format'
import { savePreferences } from '../src/lib/preferences'
import TaxAssistantPanel, { ShowTaxAssistantButton, TaxGuideBody, TaxRegionSwitch } from '../src/components/TaxAssistant'
import { fixture } from './fixtures'

// The Capacitor Preferences web implementation persists through localStorage.
const webStorage = { store: new Map<string, string>(), getItem(key: string) { return this.store.get(key) ?? null }, setItem(key: string, value: string) { this.store.set(key, value) }, removeItem(key: string) { this.store.delete(key) }, clear() { this.store.clear() } }
Object.assign(globalThis, { localStorage: webStorage, window: Object.assign(new EventTarget(), { localStorage: webStorage }) })

const languages = ['en', 'ar', 'fr', 'es', 'pt'] as const
const dictionaries = Object.fromEntries(languages.map(language => [
  language,
  JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>,
])) as Record<typeof languages[number], Record<string, string>>

const guideKeys = (region: 'MA' | 'US') => [
  ...guideFor(region).sections.flatMap(section => [section.title, ...section.bullets]),
  TAX_DISCLAIMER,
  ...Object.values(hintsFor(region)),
]

const text = (key: string) => dictionaries.en[key]

beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

test('both regions ship a dated guide whose strings are translated in all five languages', () => {
  assert.deepEqual(TAX_REGIONS, ['MA', 'US'])
  for (const language of languages) assert.equal(Object.keys(dictionaries[language]).length, Object.keys(dictionaries.en).length, language)
  const keys = new Set<string>(['Morocco', 'United States', ...Object.values(TAX_REGION_LABEL), ...guideKeys('MA'), ...guideKeys('US')])
  for (const language of languages) {
    const missing = [...keys].filter(key => typeof dictionaries[language][key] !== 'string')
    assert.deepEqual(missing, [], `${language} is missing tax assistant strings`)
  }
  for (const region of TAX_REGIONS) {
    const guide = guideFor(region)
    assert.equal(guide.region, region)
    assert.equal(guide.lastReviewed, '2026-09-30')
    assert.equal(guide.lastReviewed, TAX_GUIDE_LAST_REVIEWED)
    assert.ok(guide.sections.length >= 5, `${region} sections`)
    assert.equal(new Set(guide.sections.map(section => section.id)).size, guide.sections.length)
    for (const section of guide.sections) assert.ok(section.bullets.length > 0, section.id)
  }
  assert.match(dictionaries.ar['Tax assistant'], /المساعد الضريبي/)
  assert.match(dictionaries.fr['Tax assistant'], /Assistant fiscal/)
})

test('Morocco content covers the rates, Art. 145 content, auto-entrepreneur and a dateless e-invoicing note', () => {
  const guide = guideFor('MA')
  const section = (id: string) => guide.sections.find(row => row.id === id)!
  const body = (id: string) => [section(id).title, ...section(id).bullets].map(text).join(' ')

  const rates = body('rates')
  assert.match(rates, /20%/)
  assert.match(rates, /10%/)
  assert.match(rates, /7% and 14%/)
  assert.match(rates, /1 January 2026/)
  assert.match(rates, /exports/i)

  const content = body('content')
  assert.match(content, /Art\. 145/)
  for (const mention of ['ICE (15 digits)', 'IF', 'TP', 'RC', 'sequential', 'unit price', 'Payment method']) assert.ok(content.includes(mention), `invoice content mentions ${mention}`)

  const auto = body('auto-entrepreneur')
  assert.match(auto, /500,000 DH/)
  assert.match(auto, /TVA non applicable/)
  assert.match(auto, /CNIE/)

  // E-invoicing must not present a timeline as fact: principle only, then the DGI.
  const eInvoicing = body('e-invoicing')
  assert.match(eInvoicing, /145-IX/)
  assert.match(eInvoicing, /DGI/)
  assert.match(eInvoicing, /structured data/)
  assert.equal(/\b(?:19|20)\d{2}\b/.test(eInvoicing), false, 'the e-invoicing note must not state a year')
  assert.equal(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(eInvoicing), false, 'no dated start')
  assert.match(eInvoicing, /no date/)

  const tips = body('tips')
  assert.match(tips, /ICE or IF/)
  assert.match(tips, /deduction/)
  assert.match(tips, /sequential/)
})

test('United States content explains that sales tax is state and local, not federal', () => {
  const body = guideFor('US').sections.map(section => [section.title, ...section.bullets].map(text).join(' ')).join(' ')
  assert.match(body, /no federal sales tax/i)
  assert.match(body, /city/i)
  assert.match(body, /combined rate/i)
  assert.match(body, /nexus/i)
  assert.match(body, /resale or exemption certificate/i)
  assert.match(body, /EIN/)
  assert.match(body, /1099-NEC/)
  assert.match(body, /three to seven years/)
})

test('the assistant region follows Settings until it is switched inside the assistant', () => {
  assert.equal(settingsRegion(null), 'MA')
  assert.equal(settingsRegion({}), 'MA')
  assert.equal(settingsRegion({ taxRegion: 'US' }), 'US')
  assert.equal(assistantRegion({}), 'MA')
  assert.equal(assistantRegion({ taxRegion: 'US' }), 'US')

  // Switching inside the assistant is view-only: the document region is untouched.
  const switched = { taxRegion: 'MA', taxAssistantRegion: 'US' } as const
  assert.equal(assistantRegion(switched), 'US')
  assert.equal(settingsRegion(switched), 'MA')
  assert.notEqual(text(hintsFor('US').taxRate), text(hintsFor('MA').taxRate))

  // Unknown or legacy values never leak into the view.
  assert.equal(isTaxRegion('FR'), false)
  assert.equal(assistantRegion({ taxRegion: 'MA', taxAssistantRegion: 'XX' as never }), 'MA')
  const both = { taxRegion: 'US' as const, taxAssistantRegion: 'MA' as const }
  assert.equal(settingsRegion(both), 'US')
  assert.equal(assistantRegion(both), 'MA')
})

test('the assistant is visible by default, hidden on request, and collapses after the first view', () => {
  assert.equal(assistantVisible(null), true)
  assert.equal(assistantVisible({}), true)
  assert.equal(assistantVisible({ taxAssistantVisible: true }), true)
  assert.equal(assistantVisible({ taxAssistantVisible: false }), false)
  assert.equal(assistantStartsOpen({}), true)
  assert.equal(assistantStartsOpen({ taxAssistantSeen: false }), true)
  assert.equal(assistantStartsOpen({ taxAssistantSeen: true }), false)
})

test('settings carry the assistant fields through a validated, encrypted backup round-trip', () => {
  const settings = { ...fixture().settings[0], taxRegion: 'US', taxAssistantVisible: false, taxAssistantRegion: 'US', taxAssistantSeen: true }
  const backup = { ...fixture(), settings: [settings] }
  validateBackup(backup)
  assert.deepEqual(backup.settings[0], settings)

  // Legacy records without the fields stay importable.
  validateBackup(fixture())

  assert.throws(() => validateBackup({ ...backup, settings: [{ ...settings, taxRegion: 'FR' }] }), /no data was changed/)
  assert.throws(() => validateBackup({ ...backup, settings: [{ ...settings, taxAssistantRegion: 'ma' }] }), /no data was changed/)
  assert.throws(() => validateBackup({ ...backup, settings: [{ ...settings, taxAssistantVisible: 'yes' }] }), /no data was changed/)
})

test('the assistant adds no network surface: no fetches, no URLs, no INTERNET permission', () => {
  assert.equal(readFileSync('index.html', 'utf8').includes("connect-src 'none'"), true)
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
  assert.equal(manifest.includes('android.permission.INTERNET'), false)

  for (const file of ['src/lib/taxGuide.ts', 'src/components/TaxAssistant.tsx', 'src/modules/TaxGuide.tsx']) {
    const source = readFileSync(file, 'utf8')
    assert.equal(/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(source), false, file)
  }
})

test('the panel renders the bundled guide in every language, Arabic included', async () => {
  const noop = () => undefined
  for (const language of languages) {
    await savePreferences({ language })
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(TaxRegionSwitch, { region: 'US', onChange: noop }),
      createElement(TaxGuideBody, { region: 'MA' }),
      createElement(TaxAssistantPanel, { region: 'US', onRegionChange: noop, onApplyRegion: noop, onHide: noop, startOpen: true }),
      createElement(ShowTaxAssistantButton, { onShow: noop }),
    ))
    assert.ok(html.includes('2026-09-30'), language)
    assert.ok(html.includes(dictionaries[language]['Tax assistant']), language)
    assert.ok(html.includes(dictionaries[language]['Use this region for new invoices']), language)
    assert.ok(html.includes(dictionaries[language]['Value added tax (TVA)']), language)
    assert.ok(html.includes(dictionaries[language]['There is no federal sales tax: each state sets its own rate.']), language)
  }
  await savePreferences({ language: 'en' })
})
