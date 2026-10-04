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
    assert.equal(guide.lastReviewed, '2026-10-03')
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
  // 10% is not "everything that is not 20%": it applies only to listed operations.
  assert.match(rates, /only for the operations the CGI lists/)
  // Exemption / out-of-scope is a legal status, never presented as a rate choice.
  assert.match(rates, /legal situation, not a 0% rate/)
  assert.match(rates, /7% and 14%/)
  assert.match(rates, /1 January 2026/)
  assert.match(rates, /exports/i)
  assert.match(rates, /right to deduct/)
  assert.match(rates, /Article 99 CGI/)
  assert.match(rates, /transitional exceptions/)
  assert.match(rates, /energy and transport/)
  assert.match(rates, /franchise/)
  assert.match(rates, /thresholds differ between sales and services/)

  const content = body('content')
  assert.match(content, /Art\. 145/)
  for (const mention of ['ICE (15 digits)', 'IF', 'TP', 'RC', 'sequential', 'unit price', 'Payment method']) assert.ok(content.includes(mention), `invoice content mentions ${mention}`)

  const auto = body('auto-entrepreneur')
  // Two ceilings, not one: 200,000 DH for services, 500,000 DH for the rest.
  assert.match(auto, /200,000 DH for services/)
  assert.match(auto, /500,000 DH/)
  assert.match(auto, /1% for services, 0\.5%/)
  // The single-client rule is settled law (finance law 2023, Art. 73 CGI): a 30%
  // withholding at source on the excess, for services - never an invoicing cap.
  assert.match(auto, /80,000 DH/)
  assert.match(auto, /30% withholding at source/)
  assert.match(auto, /2023 finance law/)
  assert.match(auto, /not a cap/)
  assert.equal(auto.includes('under parliamentary discussion'), false, 'the outdated caption must be gone')
  // Out of scope of TVA, with the mention - not a 0% rate line.
  assert.match(auto, /outside the scope of TVA/)
  assert.match(auto, /TVA non applicable/)
  assert.match(auto, /CNIE/)

  const deadlines = body('payment-deadlines')
  assert.match(deadlines, /Law 69-21/)
  // Scoped, never "every Moroccan invoice must be paid within 60 days":
  // B2B only, 60 default / 120 by contract / 180 sector derogation, above 2M DH.
  assert.match(deadlines, /Between businesses/)
  assert.match(deadlines, /60 days/)
  assert.match(deadlines, /120 days/)
  assert.match(deadlines, /180 days/)
  assert.match(deadlines, /consumers are outside/)
  assert.match(deadlines, /end of the month/)
  assert.match(deadlines, /Treasury/)
  assert.match(deadlines, /Bank Al-Maghrib/)
  assert.match(deadlines, /2 million DH/)

  const records = body('records')
  assert.match(records, /10 years/)
  assert.match(records, /15 days/)
  assert.match(records, /30 days in case of force majeure/)
  assert.match(records, /keep your backups/)

  // E-invoicing must not present a timeline as fact: principle only, then the DGI.
  // The legal foundation is Article 145-IX; the universal date, threshold and penalty
  // are labelled NOT VERIFIED and the announced rollout is separated from binding law.
  const eInvoicing = body('e-invoicing')
  assert.match(eInvoicing, /Article 145-IX of the CGI/)
  assert.match(eInvoicing, /NOT VERIFIED/)
  assert.match(eInvoicing, /Government Secretariat, SGG/)
  assert.match(eInvoicing, /DGI/)
  assert.match(eInvoicing, /structured data/)
  assert.match(eInvoicing, /announced/)
  assert.match(eInvoicing, /unpublished/)
  assert.equal(/Article 119/.test(eInvoicing), false, 'the unverified Article 119 citation must stay out')
  assert.equal(/\b(?:19|20)\d{2}\b/.test(eInvoicing), false, 'the e-invoicing note must not state a year')
  assert.equal(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(eInvoicing), false, 'no dated start')
  assert.match(eInvoicing, /no date/)
  // Fatorati is offline: it must never claim to satisfy an electronic
  // submission or prior-validation requirement by itself.
  assert.match(eInvoicing, /may not satisfy/)

  // Construction & public works: the standard rate, the retention guarantee with its
  // two percentages, the public payment deadline and the "retention is not a discount"
  // accounting rule. Subcontracting keeps its declaration/acceptance condition.
  const construction = body('construction')
  assert.match(construction, /20%/)
  assert.match(construction, /only two rates/)
  assert.match(construction, /Article 92-I-28/)
  assert.match(construction, /retenue de garantie/)
  assert.match(construction, /one tenth \(10%\)/)
  assert.match(construction, /7% of the initial contract amount/)
  assert.match(construction, /mainlevée/)
  assert.match(construction, /60 days/)
  assert.match(construction, /45 days/)
  assert.match(construction, /2-16-344/)
  assert.match(construction, /intérêts moratoires/)
  assert.match(construction, /not a discount/)
  assert.match(construction, /subcontractor must be declared/)
  assert.match(construction, /paid directly by the administration/)

  // Auto-entrepreneurs and CPU taxpayers are reported to be outside the requirement,
  // and the usually cited 145-X/145-XI exclusion is still flagged for the CGI text.
  assert.match(eInvoicing, /145-X\/145-XI/)
  assert.match(eInvoicing, /Contribution Professionnelle Unique/)
  assert.match(eInvoicing, /needs checking in the CGI text/)
  // 145-I (electronic accounting) and 145-III (invoice content) must not be confused
  // with the computerized-invoicing framework.
  assert.match(eInvoicing, /145-I \(electronic accounting\)/)
  assert.match(eInvoicing, /145-III \(ordinary invoice content\)/)

  // Payroll: the CNSS shares with the cap caveat, the 2026 minimum wages, the
  // compulsory work-accident insurance and the Labour Code pointer.
  const staff = body('employing-staff')
  assert.match(staff, /21\.09%/)
  assert.match(staff, /6\.74%/)
  assert.match(staff, /6,000 MAD monthly cap/)
  assert.match(staff, /only to the short-term and long-term/)
  assert.match(staff, /17\.92 MAD per hour/)
  assert.match(staff, /1 January 2026/)
  assert.match(staff, /97\.44 MAD per working day/)
  assert.match(staff, /1 April 2026/)
  assert.match(staff, /2\.25\.983/)
  assert.match(staff, /18-12/)
  assert.match(staff, /35% of annual gross pay up to 78,000 MAD/)
  assert.match(staff, /35,000 MAD a year/)
  assert.match(staff, /600 MAD per dependent/)
  assert.match(staff, /under 40,000 MAD a year pays no tax/)
  assert.match(staff, /scale runs to 37%/)
  assert.match(staff, /65-99/)
  assert.match(staff, /1\.5 working days per month/)
  // CNSS family allowances: 300 MAD for the first three children, 36 MAD for the next three.
  assert.match(staff, /300 MAD per month for each of the first three children/)
  assert.match(staff, /36 MAD per child for the next three/)
  assert.match(staff, /six children maximum/)
  assert.match(staff, /6\.40% contribution funds them/)

  // Non-resident payments: the Article 15 categories, the verified domestic rates,
  // the treaty check and whose liability it is.
  const nonResidents = body('non-residents')
  assert.match(nonResidents, /Article 15/)
  assert.match(nonResidents, /10% of the gross amount/)
  assert.match(nonResidents, /11\.25% for 2026 distributions, 10% from 2027/)
  assert.match(nonResidents, /treaty may reduce or exempt/)
  assert.match(nonResidents, /certificate of tax residence/)
  assert.match(nonResidents, /exposes YOU to the tax/)

  // Audits: the reassessment window and the late-filing/payment scale.
  const audits = body('audits')
  assert.match(audits, /four years \(Article 226 CGI\)/)
  assert.match(audits, /ten years in case of fraud \(Article 228\)/)
  assert.match(audits, /5% of the tax up to 30 days/)
  assert.match(audits, /15%/)
  assert.match(audits, /20%/)
  assert.match(audits, /0\.5% per further month \(Article 208 CGI\)/)
  assert.match(audits, /tax tribunal/)
  assert.match(audits, /20th of the month after the period/)
  assert.match(audits, /passes 1,000,000 MAD/)
  assert.match(audits, /quarterly below it/)

  // Company taxes: the cotisation minimale base (HT, never VAT), the registration
  // duty scale and the no-single-rate warning for the local taxes.
  const formalities = body('formalities')
  // Company income tax: the 2026 proportional rates and the threshold effect.
  assert.match(formalities, /20% of net taxable profit below 100 million MAD/)
  assert.match(formalities, /35% at or above it/)
  assert.match(formalities, /40% for banks and insurers/)
  assert.match(formalities, /proportional, not progressive/)
  assert.match(formalities, /never computes income tax/)
  // Cotisation minimale: 0.25% on the HT base, 3,000 MAD floor, 36-month start.
  assert.match(formalities, /EXCLUDING tax \(HT\)/)
  assert.match(formalities, /Article 144 CGI/)
  assert.match(formalities, /0\.25% \(0\.15% in regulated sectors\)/)
  assert.match(formalities, /floor of 3,000 MAD even in a loss year/)
  assert.match(formalities, /first 36 months/)
  // Registration duty: no hard figure can be shipped - the sources disagree - so the
  // bullet names the widely cited anchor and sends the user to the notary.
  assert.match(formalities, /commonly cited as 1% of the amount with a 1,000 MAD minimum/)
  assert.match(formalities, /exemptions for company-creation acts/)
  assert.match(formalities, /confirm the amount before budgeting/)
  assert.equal(/20,000 MAD maximum/.test(formalities), false, 'the unverified 300/20,000 scale must be gone')
  // Deadlines: the return window and the four advance payments.
  assert.match(formalities, /within three months of the year end \(31 March\)/)
  assert.match(formalities, /four advance payments of 25% each/)
  assert.match(formalities, /31 March, 30 June, 30 September and 31 December/)
  assert.match(formalities, /Articles 20 and 169 CGI/)
  assert.match(formalities, /keeps no filing calendar/)
  // Cash settlement: the 5,000/day and 50,000/month deductibility caps.
  assert.match(formalities, /settled by crossed cheque, bank transfer, bill of exchange or electronic means/)
  assert.match(formalities, /5,000 MAD per day and per supplier/)
  assert.match(formalities, /50,000 MAD per month and per supplier/)
  assert.match(formalities, /Article 11-II CGI/)
  assert.match(formalities, /6% fine/)
  // Rent withholding and the local taxes with no national rate.
  assert.match(formalities, /withholds 5% at source on rent/)
  assert.match(formalities, /1 July 2026/)
  assert.match(formalities, /47-06/)
  assert.match(formalities, /no single national rate/)
  // Solidarity contribution on profits: the 1,000,000 MAD trigger, the four bands,
  // the non-deductibility and the 2028 extension.
  assert.match(formalities, /solidarity contribution on profits \(CSS\)/)
  assert.match(formalities, /reaches 1,000,000 MAD/)
  assert.match(formalities, /1\.5% up to 5 million, 2\.5% up to 10 million, 3\.5% up to 40 million, 5% above/)
  assert.match(formalities, /not deductible/)
  assert.match(formalities, /extended it through 2028/)
  // Company-law minimums: a SARL has none; an SA needs 300,000 MAD (3,000,000 if listed).
  assert.match(formalities, /SARL has no legal minimum capital/)
  assert.match(formalities, /at least 300,000 MAD \(3,000,000 if it offers shares to the public\)/)
  assert.equal(/10,000 MAD minimum/i.test(formalities), false, 'the SARL minimum-capital error must stay corrected')

  const tips = body('tips')
  assert.match(tips, /ICE or IF/)
  assert.match(tips, /deduction/)
  assert.match(tips, /sequential/)
})

test('each region carries only its own sections - Morocco content never leaks into the US guide', () => {
  const ids = (region: 'MA' | 'US') => guideFor(region).sections.map(section => section.id)
  // The US guide is the eight US sections: a Morocco section id appearing here means a
  // shared anchor was replaced twice when the guide was extended.
  assert.deepEqual(ids('US'), ['rates', 'nexus', 'certificates', 'content', 'income', 'contractors', 'records', 'tips'])
  assert.deepEqual(ids('MA'), ['rates', 'content', 'auto-entrepreneur', 'payment-deadlines', 'construction', 'records', 'e-invoicing', 'employing-staff', 'non-residents', 'audits', 'formalities', 'tips'])

  const us = guideFor('US').sections.map(section => [section.title, ...section.bullets].join(' ')).join(' ')
  for (const marker of ['CNSS', 'CGI', 'cotisation minimale', 'Article 144', 'commune', 'MAD per month', 'SARL']) {
    assert.equal(us.includes(marker), false, `US guide must not mention ${marker}`)
  }
  // The US guide keeps its own content after the removal.
  assert.match(us, /no federal sales tax/)
  assert.match(us, /1099-NEC/)
  assert.match(us, /mechanics-lien/)
})

test('United States content explains that sales tax is state and local, not federal', () => {
  const body = guideFor('US').sections.map(section => [section.title, ...section.bullets].map(text).join(' ')).join(' ')
  assert.match(body, /no federal sales tax/i)
  assert.match(body, /city/i)
  assert.match(body, /nexus/i)
  assert.match(body, /resale or exemption certificate/i)
  assert.match(body, /EIN/)
  // No universal sourcing claim: the old "rate follows the ship-to address"
  // wording is gone, replaced by state-dependent destination/origin/mixed rules.
  assert.equal(body.includes("follows the buyer's ship-to address"), false, 'no universal ship-to sourcing claim')
  assert.match(body, /destination, origin or mixed/)
  assert.match(body, /never decides the rate for you/)
  // OBBBA thresholds: $2,000 for 1099-NEC/MISC after 31 Dec 2025, 1099-K back at $20,000/200.
  assert.match(body, /1099-NEC/)
  assert.match(body, /2,000 USD/)
  assert.match(body, /31 December 2025/)
  assert.match(body, /1099-K/)
  assert.match(body, /20,000 USD and 200 transactions/)
  assert.equal(body.includes('600 USD'), false, 'the pre-2026 600 USD threshold must be gone')
  // Other 1099 categories keep their own thresholds - never one blanket number.
  assert.match(body, /royalties and payments to attorneys/)
  // A platform may report below the federal 1099-K line; states can go lower.
  assert.match(body, /below that/)
  // Reporting thresholds never decide taxability; sales tax is not income tax.
  assert.match(body, /not whether the income is taxable/)
  assert.match(body, /never an income-tax or self-employment-tax calculator/)
  // Record keeping: no single national rule, state and federal are distinct.
  assert.equal(body.includes('three to seven years'), false, 'the old universal 3-7 claim must be gone')
  assert.match(body, /each state sets its own retention period/)
  assert.match(body, /three to five years/)
  assert.match(body, /usually three years/)

  // Contractors and construction: the consumer rule with its reseller exceptions,
  // retainage caps, and the W-9/1099 practice. No state list is printed.
  const section = guideFor('US').sections.find(row => row.id === 'contractors')!
  const contractors = [section.title, ...section.bullets].map(text).join(' ')
  assert.match(contractors, /consumer of the materials/)
  assert.match(contractors, /resale certificate/)
  assert.match(contractors, /Texas/)
  assert.match(contractors, /lump-sum or separated/)
  assert.match(contractors, /capital improvement or repair/)
  assert.match(contractors, /Retainage/)
  assert.match(contractors, /5%/)
  assert.match(contractors, /flow down to subcontractors/)
  assert.match(contractors, /not a discount/)
  assert.match(contractors, /W-9/)
  assert.match(contractors, /1099-NEC/)
  assert.match(contractors, /1099-K/)
  assert.match(contractors, /backup withholding/)
  assert.match(contractors, /mechanics-lien deadlines/)
  assert.match(contractors, /preliminary notices/)
  assert.match(contractors, /state-specific/)
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
    assert.ok(html.includes('2026-10-03'), language)
    // The construction sections render too, translated, in every language.
    assert.ok(html.includes(dictionaries[language]['Construction and public works']), language)
    assert.ok(html.includes(dictionaries[language]['Contractors and construction']), language)
    assert.ok(html.includes(dictionaries[language]['Tax assistant']), language)
    assert.ok(html.includes(dictionaries[language]['Use this region for new invoices']), language)
    assert.ok(html.includes(dictionaries[language]['Value added tax (TVA)']), language)
    assert.ok(html.includes(dictionaries[language]['There is no federal sales tax: each state sets its own rate.']), language)
  }
  await savePreferences({ language: 'en' })
})
