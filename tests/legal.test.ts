import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')
const headings = (text: string) => text.split('\n').filter(line => line.startsWith('## ')).map(line => line.trim())
const permissionRows = (text: string) => [...text.matchAll(/^\| `(android\.permission\.[A-Z_]+|com\.fatorati\.app\.[A-Z_]+)`/gm)].map(match => match[1])

const privacy = read('PRIVACY.md')
const terms = read('TERMS.md')
const workflow = read('.github/workflows/android-apk.yml')

const languages = ['en', 'fr', 'ar'] as const
const privacyFiles = languages.map(language => [`docs/legal/privacy.${language}.md`, read(`docs/legal/privacy.${language}.md`)] as const)
const termsFiles = languages.map(language => [`docs/legal/terms.${language}.md`, read(`docs/legal/terms.${language}.md`)] as const)

test('the publishable policy and terms exist in English, French and Arabic with owner placeholders', () => {
  for (const [path, text] of [...privacyFiles, ...termsFiles]) {
    assert.ok(text.includes('[SUPPORT EMAIL]'), `${path} needs the [SUPPORT EMAIL] placeholder`)
    assert.ok(text.includes('[LAST UPDATED]'), `${path} needs the [LAST UPDATED] placeholder`)
    assert.ok(text.length > 2000, `${path} looks empty`)
  }
  assert.ok(privacy.includes('[SUPPORT EMAIL]') && privacy.includes('[LAST UPDATED]'))
  assert.ok(terms.includes('[SUPPORT EMAIL]') && terms.includes('[LAST UPDATED]'))
})

test('the English copies stay in step with the canonical root documents', () => {
  assert.deepEqual(headings(read('docs/legal/privacy.en.md')), headings(privacy))
  assert.deepEqual(headings(read('docs/legal/terms.en.md')), headings(terms))
  assert.deepEqual(permissionRows(read('docs/legal/privacy.en.md')), permissionRows(privacy))
  assert.ok(privacy.split('\n').length > 60 && terms.split('\n').length > 40)
})

test('every translation lists the same permissions as the English policy', () => {
  const expected = permissionRows(privacy)
  assert.ok(expected.length >= 6, `expected the full permission list, found ${expected.length}`)
  for (const [path, text] of privacyFiles) {
    assert.deepEqual(permissionRows(text), expected, path)
  }
  for (const [path, text] of termsFiles) {
    // Terms never invent a permission of their own.
    assert.deepEqual(permissionRows(text), [], path)
  }
})

test('the documented permission list is exactly the allowlist CI enforces', () => {
  const allowlist = workflow
    .split('\n')
    .map(line => line.trim().replace(/"$/, ''))
    .filter(line => /^(android\.permission\.[A-Z_]+|com\.fatorati\.app\.[A-Z_]+)$/.test(line))
  const documented = permissionRows(privacy)
  assert.deepEqual([...allowlist].sort(), [...documented].sort())
  // And the deny-list checks that matter to the store listing are still present.
  for (const forbidden of ['INTERNET', 'MANAGE_EXTERNAL_STORAGE', 'SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM']) {
    assert.ok(workflow.includes(forbidden), `${forbidden} must stay in the CI deny list`)
  }
  assert.ok(workflow.includes('POST_NOTIFICATIONS'))
})

test('the legal texts make no certification or compliance claim', () => {
  for (const [path, text] of [['PRIVACY.md', privacy], ['TERMS.md', terms], ...privacyFiles, ...termsFiles]) {
    for (const claim of ['DGI compliant', 'DGI-compliant', 'certified by', 'approved by', 'officially approved', 'guaranteed']) {
      assert.equal(text.toLowerCase().includes(claim.toLowerCase()), false, `${path} must not claim "${claim}"`)
    }
  }
  // The honest statements the audit asked for are present.
  assert.ok(privacy.includes('are not encrypted'))
  assert.ok(privacy.includes('blocked by default'))
  assert.ok(terms.includes('no PIN recovery'))
  assert.ok(terms.includes('as is'))
  assert.ok(terms.includes('not tax, legal or accounting advice'))
})
