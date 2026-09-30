import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { TAX_REGIONS, TAX_REGION_LABEL } from '../src/lib/taxGuide'

const listing = (language: 'en' | 'fr' | 'ar') => readFileSync(`store/listing.${language}.md`, 'utf8')
const blocks = (text: string) => [...text.matchAll(/## [^\n]+\n\n```\n([\s\S]*?)```/g)].map(match => match[1].trim())

const LIMITS = { title: 30, short: 80, full: 4000, whatsnew: 500 }
const languages = ['en', 'fr', 'ar'] as const

test('every listing stays inside the Play character limits', () => {
  for (const language of languages) {
    const [title, short, full, whatsnew] = blocks(listing(language))
    assert.ok(title && short && full && whatsnew, `${language}: four blocks expected`)
    assert.ok(title.length <= LIMITS.title, `${language} title is ${title.length}`)
    assert.ok(short.length <= LIMITS.short, `${language} short description is ${short.length}`)
    assert.ok(full.length <= LIMITS.full, `${language} full description is ${full.length}`)
    assert.ok(whatsnew.length <= LIMITS.whatsnew, `${language} what's new is ${whatsnew.length}`)
    assert.ok(full.split('\n').length > 15, `${language} full description looks empty`)
  }
})

test('the copy only makes claims the app can back up', () => {
  const claims: Record<typeof languages[number], string[]> = {
    en: ['No account', 'no ads', 'works entirely on your phone', 'cannot send anything anywhere', 'not tax advice'],
    fr: ['sans compte', 'aucune publicité', 'il ne peut donc rien envoyer nulle part', "non d'un conseil fiscal"],
    ar: ['بلا حساب', 'بلا إعلانات', 'لا يستطيع إرسال أي شيء إلى أي جهة', 'نصيحة ضريبية'],
  }
  for (const language of languages) {
    const text = listing(language)
    for (const claim of claims[language]) assert.ok(text.includes(claim), `${language} is missing: ${claim}`)
    // The export warning must survive in every language.
    assert.match(text, /CSV|Excel/, `${language} must mention the exports`)
  }
  // The English listing is the one tests can read literally: it must warn about the
  // unencrypted exports and state the app is not certified by a tax authority.
  const en = listing('en')
  assert.ok(en.includes('those CSV/PDF/Excel files are not encrypted'))
  assert.ok(en.includes('not affiliated with, certified by or approved by any tax authority'))
})

test('no listing claims compliance, certification, approval or a guarantee', () => {
  const negations = ['not', "n'est", 'ni ', 'no ', 'never', 'pas ', 'aucun', 'غير', 'لا ', 'بلا', 'ليس']
  for (const language of languages) {
    const text = listing(language)
    for (const word of ['DGI compliant', 'compliant', 'certified', 'certifié', 'approved', 'approuvé', 'guarantee', 'garanti', 'معتمد', 'مصادق', 'معتمدة']) {
      let index = text.toLowerCase().indexOf(word.toLowerCase())
      while (index !== -1) {
        const window = text.slice(Math.max(0, index - 80), index + word.length + 80).toLowerCase()
        assert.ok(negations.some(marker => window.includes(marker.toLowerCase())),
          `${language}: "${word}" appears without a negation nearby -> ${window}`)
        index = text.toLowerCase().indexOf(word.toLowerCase(), index + word.length)
      }
    }
  }
})

test('the assets checklist names the required sizes and never ships a fake screenshot', () => {
  const todo = readFileSync('store/ASSETS-TODO.md', 'utf8')
  for (const required of ['512 × 512', '1024 × 500', 'minimum 2', 'real capture', '[SUPPORT EMAIL]', 'privacy']) {
    assert.ok(todo.includes(required), `ASSETS-TODO.md is missing: ${required}`)
  }
  assert.ok(todo.includes('never a real'))
  // No image was generated for the listing: the folder holds text only.
  const files = readdirSync('store')
  assert.deepEqual(files.filter(file => /\.(png|jpe?g|webp)$/i.test(file)), [])
  assert.deepEqual(files.sort(), ['ASSETS-TODO.md', 'listing.ar.md', 'listing.en.md', 'listing.fr.md'])
})

test('the console answer sheet covers every declaration Play asks for', () => {
  const answers = readFileSync('docs/PLAY-CONSOLE-ANSWERS.md', 'utf8')
  for (const section of [
    'App access', 'Data safety', 'Government apps', 'Financial features',
    'Content rating', 'Target audience', 'Permission justifications', 'Suggested store settings',
  ]) {
    assert.ok(answers.includes(section), `PLAY-CONSOLE-ANSWERS.md is missing: ${section}`)
  }
  assert.ok(answers.includes('135790'), 'the reviewer PIN example must be usable as written')
  assert.match(answers, /adults \(18 and over\)/)
  assert.ok(answers.includes('My app does not contain ads'))
  assert.ok(answers.includes('[SUPPORT EMAIL]') && answers.includes('[PRIVACY URL]'))
  // The permission justification table must repeat the real permission names.
  for (const permission of ['POST_NOTIFICATIONS', 'USE_BIOMETRIC', 'USE_FINGERPRINT', 'RECEIVE_BOOT_COMPLETED', 'WAKE_LOCK']) {
    assert.ok(answers.includes(permission), `missing justification for ${permission}`)
  }
  assert.equal(answers.includes('DGI compliant'), false)
})

test('the listings claim exactly the tax regions the code ships', () => {
  // The app supports five interface languages but only two tax regions; the copy
  // must never promise guidance that does not exist.
  assert.deepEqual(TAX_REGIONS, ['MA', 'US'])
  assert.deepEqual(TAX_REGIONS.map(region => TAX_REGION_LABEL[region]), ['Morocco', 'United States'])
  const names = {
    en: ['Morocco', 'United States'],
    fr: ['Maroc', 'États-Unis'],
    ar: ['المغرب', 'الولايات المتحدة'],
  } as const
  const notShipped = ['France', 'French', 'Spain', 'Spanish', 'Portugal', 'Portuguese', 'Espagne', 'espagnol', 'espagnole', 'البرتغال', 'البرتغالية', 'إسبانيا', 'الإسبانية', 'فرنسا', 'الفرنسية']
  const taxLine = /tax guide|tax assistant|guide fiscal|fiscaux|fiscales|ضريب/i
  for (const language of languages) {
    const lines = listing(language).split('\n').filter(line => taxLine.test(line))
    assert.ok(lines.length >= 2, `${language} must describe the tax guide and list it in "What's new"`)
    const joined = lines.join('\n')
    for (const name of names[language]) {
      assert.ok(joined.includes(name), `${language}: the tax copy must name ${name}`)
    }
    for (const line of lines) {
      for (const name of notShipped) {
        assert.equal(line.includes(name), false, `${language}: "${name}" is not a shipped tax region -> ${line}`)
      }
    }
  }
  const answers = readFileSync('docs/PLAY-CONSOLE-ANSWERS.md', 'utf8')
  assert.ok(answers.includes('its tax guide currently covers Morocco and the United States'))
})
