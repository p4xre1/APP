import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CONFIGURED_LINKS, SUPPORT_EMAIL, PRIVACY_POLICY_URL, TERMS_URL,
  aboutLinks, privacyPolicyUrl, resolveAboutLinks, supportEmail, termsUrl,
} from '../src/lib/appConfig'

// The Capacitor Preferences web implementation persists through localStorage.
const webStorage = { store: new Map<string, string>(), getItem(key: string) { return this.store.get(key) ?? null }, setItem(key: string, value: string) { this.store.set(key, value) }, removeItem(key: string) { this.store.delete(key) }, clear() { this.store.clear() } }
Object.assign(globalThis, { localStorage: webStorage, window: Object.assign(new EventTarget(), { localStorage: webStorage }) })

const settingsSource = readFileSync('src/modules/Settings.tsx', 'utf8')

test('the shipped configuration is empty and nothing is invented', () => {
  assert.equal(SUPPORT_EMAIL, '')
  assert.equal(PRIVACY_POLICY_URL, '')
  assert.equal(TERMS_URL, '')
  assert.deepEqual(CONFIGURED_LINKS, { supportEmail: '', privacyPolicyUrl: '', termsUrl: '' })
  assert.equal(supportEmail(), null)
  assert.equal(privacyPolicyUrl(), null)
  assert.equal(termsUrl(), null)
  assert.deepEqual(aboutLinks(), [])
  // Only the placeholder list may mention a documentation placeholder or a fake contact.
  const literals = settingsSource.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|https?:\/\/[^\s'"]+/g) ?? []
  assert.deepEqual(literals, [], `Settings.tsx must not hard-code a contact or URL: ${literals.join(', ')}`)
})

test('documentation placeholders, junk and non-http schemes never reach the About card', () => {
  const rejected = {
    supportEmail: ['[SUPPORT EMAIL]', 'owner@business.com', 'example.com', 'not-an-email', 'a@b', '  ', 'mailto:x@y.com'],
    privacyPolicyUrl: ['[PRIVACY POLICY URL]', 'example.com', 'javascript:alert(1)', 'data:text/html,x', 'ftp://host/policy', 'http://'],
    termsUrl: ['[TERMS URL]', 'owner@business.com', 'javascript:void(0)', '  terms  '],
  }
  for (const [field, values] of Object.entries(rejected)) {
    for (const value of values) {
      const links = resolveAboutLinks({ supportEmail: '', privacyPolicyUrl: '', termsUrl: '', [field]: value })
      assert.deepEqual(links, [], `${field} = ${JSON.stringify(value)} must stay hidden`)
    }
  }
})

test('a configured address or URL becomes exactly one row, in policy/terms/support order', () => {
  const links = resolveAboutLinks({
    supportEmail: ' support@example.org ',
    privacyPolicyUrl: 'https://example.org/privacy',
    termsUrl: 'https://example.org/terms',
  })
  assert.deepEqual(links, [
    { label: 'Privacy policy', href: 'https://example.org/privacy', external: true },
    { label: 'Terms of use', href: 'https://example.org/terms', external: true },
    { label: 'Support', href: 'mailto:support@example.org', external: false },
  ])
  // Partial configuration shows only what exists, never an empty row.
  assert.deepEqual(resolveAboutLinks({ supportEmail: '', privacyPolicyUrl: 'https://example.org/p', termsUrl: '' })
    .map(link => link.label), ['Privacy policy'])
  // Every label the card can produce is a translation key in all five dictionaries.
  for (const language of ['en', 'ar', 'fr', 'es', 'pt']) {
    const dictionary = JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>
    for (const key of ['About', 'Privacy policy', 'Terms of use', 'Support', 'Opens in your browser', 'Example email']) {
      assert.ok(dictionary[key]?.trim(), `${language} is missing "${key}"`)
    }
    assert.equal(dictionary['owner@business.com'], undefined, `${language} still ships the fake contact placeholder`)
  }
})

test('the About card is keyed off the configuration, not off a literal', () => {
  for (const fragment of [
    "import { aboutLinks } from '../lib/appConfig'",
    'const links = aboutLinks()',
    'links.length > 0 &&',
    "target={link.external ? '_blank' : undefined}",
    "rel={link.external ? 'noopener noreferrer' : undefined}",
    'min-h-12',
    't(TAX_DISCLAIMER)',
  ]) {
    assert.ok(settingsSource.includes(fragment), `Settings.tsx is missing: ${fragment}`)
  }
  assert.equal(settingsSource.includes('owner@business.com'), false)
})

test('with the shipped configuration nothing in Settings links outside the app', async () => {
  const { default: Settings } = await import('../src/modules/Settings')
  const html = renderToStaticMarkup(createElement(Settings, {}))
  assert.ok(html.includes('About'), 'the About card must render')
  assert.ok(html.includes('General information, not tax advice'), 'the tax disclaimer must render')
  assert.ok(html.includes('Help &amp; legal'), 'the Help & legal card must render')
  // Privacy policy / Terms of use / Get help / FAQ are in-app navigation buttons,
  // so the page still renders no link at all while the configuration is empty:
  // no href, no mailto, no external target and no "opens in your browser" note.
  assert.deepEqual([...html.matchAll(/href="[^"]*"/g)].map(match => match[0]), [])
  assert.equal(html.includes('mailto:'), false)
  assert.equal(html.includes('target="_blank"'), false)
  assert.equal(html.includes('Opens in your browser'), false)
})
