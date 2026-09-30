import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { savePreferences } from '../src/lib/preferences'
import { I18nProvider } from '../src/i18n'
import {
  LEGAL_DOCUMENT_LANGUAGES, LEGAL_TEXT, LEGAL_SOURCE_FILES, LEGAL_TITLE,
  inlineTokens, legalBlocks, legalDocument, legalLastUpdated, legalOnlineUrl, legalSections, legalTranslation,
} from '../src/lib/legal'
import { FAQ_ITEMS, FAQ_TOPIC_LABEL, FAQ_TOPICS, filterFaq } from '../src/lib/faq'
import { appInfo, appInfoLines, isDevelopmentBuild, parseUserAgent, problemReportBody, problemReportHref, showsUnconfiguredSupportNotice } from '../src/lib/help'
import { APP_VERSION } from '../src/lib/version'

// The Capacitor Preferences web implementation persists through localStorage.
const webStorage = { store: new Map<string, string>(), getItem(key: string) { return this.store.get(key) ?? null }, setItem(key: string, value: string) { this.store.set(key, value) }, removeItem(key: string) { this.store.delete(key) }, clear() { this.store.clear() } }
Object.assign(globalThis, { localStorage: webStorage, window: Object.assign(new EventTarget(), { localStorage: webStorage }) })

const languages = ['en', 'ar', 'fr', 'es', 'pt'] as const
type Language = typeof languages[number]
const dictionaries = Object.fromEntries(languages.map(language => [
  language,
  JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>,
])) as Record<Language, Record<string, string>>
const translate = (language: Language) => (key: string) => dictionaries[language][key] ?? key
/** React escapes these five characters in text nodes, so comparisons need them escaped too. */
const escaped = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

const { default: LegalBody } = await import('../src/components/LegalBody')
const { default: LegalOverlay } = await import('../src/components/LegalOverlay')
const { default: LegalDocument } = await import('../src/modules/LegalDocument')
const { default: HelpCenter } = await import('../src/modules/HelpCenter')
const { default: Faq } = await import('../src/modules/Faq')

async function render(language: Language, ...elements: ReactElement[]) {
  await savePreferences({ language })
  // The app wraps everything in I18nProvider; without it useI18n() would fall back to en.
  return renderToStaticMarkup(createElement(I18nProvider, null, createElement('div', null, ...elements)))
}

const read = (path: string) => readFileSync(path, 'utf8')
const NEW_FILES = ['src/modules/HelpCenter.tsx', 'src/modules/Faq.tsx', 'src/modules/LegalDocument.tsx', 'src/components/LegalBody.tsx', 'src/components/LegalOverlay.tsx', 'src/lib/legal.ts', 'src/lib/faq.ts', 'src/lib/help.ts']

test('the in-app legal text is byte-identical to docs/legal, the single source of truth', () => {
  for (const kind of ['privacy', 'terms'] as const) {
    for (const language of LEGAL_DOCUMENT_LANGUAGES) {
      const file = LEGAL_SOURCE_FILES[kind][language]
      assert.equal(file, `docs/legal/${kind}.${language}.md`)
      assert.equal(LEGAL_TEXT[kind][language], read(file), `${file} drifted from the generated module`)
      assert.ok(LEGAL_TEXT[kind][language].length > 1500, `${file} looks truncated`)
    }
  }
  // Nothing in the app may carry a second, hand-written copy of the policy.
  const handWritten = /We do not collect|Nous ne collectons|no PIN recovery|There is no PIN recovery/
  for (const file of NEW_FILES) {
    assert.equal(handWritten.test(read(file)), false, `${file} must not inline legal text`)
  }
  // The generator is the only way the strings reach the app, and the build runs it.
  assert.ok(read('scripts/legal-content.mjs').includes('docs/legal'))
  assert.ok((JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts.build.includes('scripts/legal-content.mjs'))
})

test('a language without a bundled translation falls back to English with a notice, never to a guess', () => {
  assert.deepEqual(LEGAL_DOCUMENT_LANGUAGES, ['en', 'fr', 'ar'])
  for (const language of ['en', 'fr', 'ar'] as const) assert.deepEqual(legalTranslation(language), { language, fallback: false })
  for (const language of ['es', 'pt', 'de']) assert.deepEqual(legalTranslation(language), { language: 'en', fallback: true }, language)
  const document = legalDocument('privacy', 'pt')
  assert.equal(document.language, 'en')
  assert.equal(document.fallback, true)
  assert.equal(document.text, LEGAL_TEXT.privacy.en)
  // No document may lose a section in translation.
  for (const kind of ['privacy', 'terms'] as const) {
    const count = legalSections(LEGAL_TEXT[kind].en).length
    assert.ok(count >= 4, `${kind} has ${count} sections`)
    for (const language of LEGAL_DOCUMENT_LANGUAGES) {
      const sections = legalSections(LEGAL_TEXT[kind][language])
      assert.equal(sections.length, count, `${kind}.${language} is missing a section`)
      assert.equal(sections.filter(section => !section.trim()).length, 0)
    }
  }
})

test('the legal screens render the bundled text and label the empty placeholders', async () => {
  const fallbackNotice = 'This document is only available in English, French and Arabic, so the English text is shown.'
  for (const language of languages) {
    const dictionary = dictionaries[language]
    const html = await render(language,
      createElement(LegalDocument, { kind: 'privacy', onBack: () => undefined }),
      createElement(LegalDocument, { kind: 'terms', onBack: () => undefined }),
      createElement(LegalBody, { kind: 'privacy' }),
    )
    assert.ok(html.includes(escaped(dictionary[LEGAL_TITLE.privacy])), language)
    assert.ok(html.includes(escaped(dictionary[LEGAL_TITLE.terms])), language)
    assert.ok(html.includes(escaped(dictionary['Bundled offline. This is the full text, not a summary.'])), language)
    assert.ok(html.includes(escaped(dictionary['Last updated'])), language)
    assert.ok(html.includes(APP_VERSION), `${language} must show the app version`)
    assert.equal(/\[SUPPORT EMAIL\]|\[LAST UPDATED\]/.test(html), false, `${language}: raw placeholders must not reach the screen`)
    // Relative repo links inside the documents render as text, never as dead links.
    assert.equal(/href="[^"]*\.md/.test(html), false, language)
    assert.equal(/[\u0600-\u06FF]/.test(html), language === 'ar', `${language} script check`)
    if (language === 'es' || language === 'pt') {
      assert.ok(html.includes(escaped(dictionary[fallbackNotice])), `${language} needs the fallback notice`)
      assert.ok(html.includes(legalSections(LEGAL_TEXT.privacy.en)[0]), `${language} reads the English document`)
    } else {
      assert.equal(html.includes(escaped(dictionary[fallbackNotice])), false, language)
    }
  }
  await savePreferences({ language: 'en' })
})

test('the documents show the app version and the online row only when an URL is configured', async () => {
  assert.equal(legalOnlineUrl('privacy'), null)
  assert.equal(legalOnlineUrl('terms'), null)
  const html = await render('en', createElement(LegalBody, { kind: 'terms' }))
  assert.ok(html.includes(APP_VERSION))
  assert.equal(html.includes('Open online version'), false)
  assert.equal(html.includes('href='), false)
  // The markdown header still carries the owner placeholder, so the screen says so.
  for (const language of LEGAL_DOCUMENT_LANGUAGES) {
    assert.deepEqual(legalLastUpdated(LEGAL_TEXT.privacy[language]), { value: null, pending: true }, language)
  }
  assert.deepEqual(legalLastUpdated('**Last updated: 2026-01-31** · text'), { value: '2026-01-31', pending: false })
})

test('markdown is rendered as escaped text: no raw HTML, no unknown link scheme', async () => {
  const tokens = inlineTokens('<script>alert(1)</script> and **bold** and [label](javascript:alert(1))')
  assert.ok(tokens.map(token => token.text).join('').includes('<script>alert(1)</script>'))
  assert.equal(tokens.some(token => token.type === 'link'), false, 'a javascript: target must not become a link')
  assert.ok(tokens.some(token => token.type === 'strong'))
  const blocks = legalBlocks('# Title\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- one\n- two\n\nplain <b>html</b>')
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'table', 'list', 'paragraph'])
  const table = blocks[1]
  assert.deepEqual(table.type === 'table' ? table.head : [], ['A', 'B'])
  assert.deepEqual(table.type === 'table' ? table.rows : [], [['1', '2']])
  for (const file of ['src/components/LegalBody.tsx', 'src/lib/legal.ts']) {
    assert.equal(read(file).includes('dangerouslySetInnerHTML'), false, file)
    assert.equal(read(file).includes('innerHTML'), false, file)
  }
  const html = await render('en', createElement(LegalBody, { kind: 'privacy' }))
  assert.ok(html.includes('<strong'))
  assert.equal(/<script/i.test(html), false)
})

test('every FAQ item is translated in all five languages and covers the shipped topics', () => {
  assert.deepEqual(FAQ_TOPICS, ['data', 'backup', 'invoices', 'tax', 'subscriptions', 'general'])
  assert.equal(new Set(FAQ_ITEMS.map(item => item.id)).size, FAQ_ITEMS.length)
  for (const topic of FAQ_TOPICS) assert.ok(FAQ_ITEMS.some(item => item.topic === topic), topic)
  for (const id of ['data-storage', 'data-upload', 'data-forgot-pin', 'data-lost-phone', 'data-uninstall', 'data-change-pin', 'data-biometric',
    'backup-create', 'backup-restore', 'backup-password', 'backup-plaintext', 'backup-where',
    'invoice-number', 'invoice-sequential', 'invoice-paid', 'invoice-edit', 'invoice-tax', 'invoice-region', 'invoice-identifiers', 'invoice-estimates',
    'tax-advice', 'tax-reviewed', 'tax-official',
    'subscriptions-reminders', 'subscriptions-missing', 'subscriptions-status', 'subscriptions-currencies', 'subscriptions-hidden',
    'general-offline', 'general-language', 'general-free', 'general-support']) {
    assert.ok(FAQ_ITEMS.some(item => item.id === id), `missing FAQ item ${id}`)
  }
  const keys = [...Object.values(FAQ_TOPIC_LABEL), ...FAQ_ITEMS.flatMap(item => [item.question, item.answer])]
  for (const language of languages) {
    assert.deepEqual(keys.filter(key => !dictionaries[language][key]?.trim()), [], `${language} is missing FAQ strings`)
  }
  // The answers never promise a certification or a body the app does not deal with.
  const answers = FAQ_ITEMS.map(item => dictionaries.en[item.answer]).join(' ')
  for (const claim of ['DGI compliant', 'DGI-compliant', 'certified by the DGI', 'approved by the DGI']) {
    assert.equal(answers.includes(claim), false, claim)
  }
})

test('the FAQ search works in English, French and Arabic and finds nothing when it should', () => {
  const ids = (query: string, language: Language) => filterFaq(query, translate(language)).map(item => item.id)
  assert.ok(ids('forgot pin', 'en').includes('data-forgot-pin'))
  assert.ok(ids('uninstall', 'en').includes('data-uninstall'))
  assert.ok(ids('sauvegarde chiffrée', 'fr').includes('backup-create'))
  assert.ok(ids('sauvegarde chiffree', 'fr').includes('backup-create'), 'accents are ignored')
  assert.ok(ids('TVA', 'fr').includes('invoice-tax'))
  assert.ok(ids('رقم الفاتورة', 'ar').includes('invoice-number'))
  assert.ok(ids('نسيت', 'ar').includes('data-forgot-pin'))
  assert.deepEqual(ids('montgolfiere', 'fr'), [])
  assert.deepEqual(ids('zzzz-no-such-answer', 'en'), [])
  assert.equal(filterFaq('', translate('ar')).length, FAQ_ITEMS.length)
})

test('the support row follows the configuration and the owner notice never ships', async () => {
  assert.equal(isDevelopmentBuild(), false, 'the test environment is not a Vite dev build')
  assert.equal(isDevelopmentBuild({ DEV: true }), true)
  assert.equal(isDevelopmentBuild({ DEV: false }), false)
  assert.equal(showsUnconfiguredSupportNotice(null, true), true)
  assert.equal(showsUnconfiguredSupportNotice(null, false), false, 'a release build must not show the owner notice')
  assert.equal(showsUnconfiguredSupportNotice('support@example.org', true), false)
  const html = await render('en', createElement(HelpCenter, { onBack: () => undefined, onNavigate: () => undefined }))
  assert.equal(html.includes('Contact support'), false, 'no support row while SUPPORT_EMAIL is empty')
  assert.equal(html.includes('Support contact not configured yet'), false, 'the notice must not render here')
  assert.ok(html.includes('Report a problem'))
  assert.ok(read('src/modules/HelpCenter.tsx').includes('showsUnconfiguredSupportNotice(email)'))
})

test('the problem report carries only non-sensitive app information', () => {
  const device = parseUserAgent('Mozilla/5.0 (Linux; Android 14; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126 Mobile Safari/537.36')
  assert.deepEqual(device, { android: '14', model: 'SM-A536B' })
  assert.deepEqual(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64)'), { android: null, model: null })
  const info = appInfo('ar', device)
  const lines = appInfoLines(info)
  assert.equal(lines.length, 4)
  assert.match(lines[0], new RegExp(`^${dictionaries.en['App version']}: v`))
  assert.ok(lines[1].endsWith('14'))
  assert.ok(lines[2].endsWith('SM-A536B'))
  assert.ok(lines[3].endsWith(dictionaries.en['language.ar']), 'the language line names the selected language')
  const body = problemReportBody(info)
  for (const secret of ['INV-2026-0007', 'Acme SARL', 'عميل', 'fatima@example.com', '135790', 'fatorati-backup.fatorati']) {
    assert.equal(body.includes(secret), false, `${secret} must never reach the report`)
  }
  assert.equal(body.split('\n').length, 6, 'four lines, a blank line and the warning')
  assert.ok(body.includes(dictionaries.en['Describe the problem here. Never include invoices, customers, your PIN, a backup file or app logs.']))
  // Without a configured address the mail app opens with an empty recipient, never a made-up one.
  const unconfigured = problemReportHref(info, null)
  assert.ok(unconfigured.startsWith('mailto:?'))
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(unconfigured), false)
  const configured = problemReportHref(info, 'support@example.org')
  assert.ok(configured.startsWith('mailto:support@example.org?'))
  assert.ok(decodeURIComponent(configured).includes('SM-A536B'))
  assert.equal(read('src/lib/help.ts').includes("from './vault'"), false)
  for (const file of NEW_FILES) {
    assert.equal(/\buseFatorati\b/.test(read(file)), false, `${file} must not read the store`)
    assert.equal(/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(read(file)), false, file)
  }
})

test('the new screens render in every language, RTL aware, with a 48 px tap target per row', async () => {
  for (const language of languages) {
    const dictionary = dictionaries[language]
    const html = await render(language,
      createElement(HelpCenter, { onBack: () => undefined, onNavigate: () => undefined }),
      createElement(Faq, { onBack: () => undefined }),
      createElement(LegalOverlay, { kind: 'terms', onClose: () => undefined }),
    )
    for (const key of ['Get help', 'FAQ', 'Search the FAQ', 'Troubleshooting', 'Make a backup now', 'Data & security', 'Notifications are not arriving']) {
      assert.ok(html.includes(escaped(dictionary[key])), `${language}: ${key}`)
    }
    assert.ok(html.includes(escaped(dictionary[LEGAL_TITLE.terms])), language)
    // Four troubleshooting entries plus every FAQ answer are accordions.
    assert.equal((html.match(/<summary/g) ?? []).length, FAQ_ITEMS.length + 4, language)
    assert.ok(html.includes('directional'), `${language}: arrows must mirror in RTL`)
    if (language === 'ar') assert.ok(/[\u0600-\u06FF]/.test(html))
  }
  await savePreferences({ language: 'en' })
  for (const file of NEW_FILES.filter(file => file.endsWith('.tsx'))) {
    const source = read(file)
    if (/ArrowLeft|ChevronRight/.test(source)) assert.ok(source.includes('directional'), `${file} must mirror its arrows in RTL`)
  }
  for (const file of ['src/modules/HelpCenter.tsx', 'src/modules/LegalDocument.tsx', 'src/components/LegalBody.tsx', 'src/modules/Settings.tsx', 'src/components/Onboarding.tsx', 'src/components/SecurityGate.tsx', 'src/components/LegalOverlay.tsx']) {
    const source = read(file)
    // Row styles live in constants (sometimes composed), so resolve them.
    const constants = new Map([...source.matchAll(/const\s+(\w+)\s*=\s*(?:'([^']*)'|`([^`]*)`)/g)].map(match => [match[1], match[2] ?? match[3] ?? '']))
    const tallRow = (name: string, depth = 0): boolean => {
      const value = constants.get(name) ?? ''
      if (value.includes('min-h-12')) return true
      return depth < 3 && [...value.matchAll(/\{(\w+)\}/g)].some(match => tallRow(match[1], depth + 1))
    }
    for (const chunk of source.split('<a ').slice(1)) {
      const tag = chunk.slice(0, chunk.indexOf('>'))
      const viaConstant = [...tag.matchAll(/\{(\w+)\}/g)].some(match => tallRow(match[1]))
      // Inline links inside a paragraph are exempt from the target-size rule (WCAG 2.5.8);
      // a row link is the one laid out with items-center.
      const inline = !/items-center/.test(tag)
      assert.ok(tag.includes('min-h-12') || viaConstant || inline, `${file}: ${tag.slice(0, 70)} needs a 48 px target`)
    }
  }
  for (const file of ['src/components/Onboarding.tsx', 'src/components/SecurityGate.tsx']) {
    const source = read(file)
    assert.ok(source.includes("setLegal('privacy')") && source.includes("setLegal('terms')"), file)
    assert.ok(source.includes('LegalOverlay'), file)
  }
  const settings = read('src/modules/Settings.tsx')
  for (const key of ["key: 'help'", "key: 'faq'", "key: 'privacy'", "key: 'terms'"]) assert.ok(settings.includes(key), key)
  assert.ok(settings.includes('min-h-12 w-full'))
})

test('the help area stays offline: no new permission, no queries entry, no network', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml')
  assert.equal(manifest.includes('<queries'), false, 'the mailto rows must not add a <queries> block')
  assert.equal(manifest.includes('android.permission.INTERNET'), false)
  assert.ok(read('index.html').includes("connect-src 'none'"))
  const types = read('src/store/types.ts')
  for (const key of ["'help'", "'faq'", "'privacy'", "'terms'"]) assert.ok(types.includes(key), key)
  const app = read('src/App.tsx')
  for (const fragment of ["case 'help'", "case 'faq'", "case 'privacy'", "case 'terms'", "import('./modules/HelpCenter')", "import('./modules/Faq')", "import('./modules/LegalDocument')"]) {
    assert.ok(app.includes(fragment), fragment)
  }
  const shell = read('src/components/AppShell.tsx')
  assert.ok(shell.includes("help:'Get help', faq:'FAQ', privacy:'Privacy policy', terms:'Terms of use'"), 'the header must not fall back to "Tax guide"')
  // CI checks the *merged* manifest (app + every library), which is the file that
  // ships: permissions are allow-listed and a <queries> block fails the build.
  const workflow = read('.github/workflows/android-apk.yml')
  assert.ok(workflow.includes('Verify the merged release manifest permissions'))
  assert.ok(workflow.includes("grep -q '<queries'"), 'CI must fail if a dependency adds <queries>')
  // No Capacitor plugin or library the app links ships a <queries> element either,
  // so the merged manifest cannot gain one behind the app manifest's back.
  const pluginManifests = read('android/app/src/main/AndroidManifest.xml')
  assert.equal(pluginManifests.includes('queries'), false)
})
