import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const languages = ['en', 'ar', 'fr', 'es', 'pt'] as const
const dictionaries = Object.fromEntries(languages.map(language => [
  language,
  JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>,
])) as Record<typeof languages[number], Record<string, string>>

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => (entry.isDirectory() ? sources(join(directory, entry.name)) : [join(directory, entry.name)]))
}
const files = sources('src').filter(file => /\.tsx?$/.test(file))

/**
 * Returns the first argument of the call that starts at `start`, ignoring commas
 * and parentheses that live inside string literals - the naive version truncated
 * `t(region === 'MA' ? 'ICE (15 digits)' : 'Tax number')` at the parenthesis.
 */
function firstArgument(text: string, start: number): string {
  let depth = 0
  let quote: string | null = null
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = null
      continue
    }
    if (character === "'" || character === '"' || character === '`') { quote = character; continue }
    if (character === '(' || character === '[' || character === '{') depth += 1
    else if (character === ')' || character === ']' || character === '}') {
      if (depth === 0) return text.slice(start, index)
      depth -= 1
    } else if (character === ',' && depth === 0) return text.slice(start, index)
  }
  return text.slice(start, start + 300)
}

/** Literals that are compared instead of translated ('MA' in `region === 'MA'`). */
const comparison = (argument: string, index: number, length: number) =>
  /(===|!==|==|!=|\bin\b)\s*$/.test(argument.slice(0, index)) || /^\s+in\s/.test(argument.slice(index + length))

/** Source strings escape apostrophes; the dictionaries hold the plain character. */
const unescape = (value: string) => value.replace(/\\'/g, "'").replace(/\\\\/g, '\\')

test('every literal string passed to t() exists in all five dictionaries', () => {
  const used = new Map<string, string>()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const call of text.matchAll(/\b(?:t|tr)\(/g)) {
      const argument = firstArgument(text, call.index + call[0].length)
      for (const literal of argument.matchAll(/'((?:[^'\\]|\\.)+)'/g)) {
        const key = unescape(literal[1])
        if (comparison(argument, literal.index, literal[0].length)) continue
        // Class names never reach t(): only keys, labels and data values do.
        if (/^[a-z-]+(?:[:/][a-z0-9-]+)+$/.test(key)) continue
        if (/^-?\d+(\.\d+)?(px|rem|%)?$/.test(key)) continue
        if (!used.has(key)) used.set(key, file)
      }
    }
  }
  assert.ok(used.size > 240, `only ${used.size} keys found - the scanner stopped working`)
  const missing: string[] = []
  for (const language of languages) {
    for (const [key, file] of used) {
      const value = dictionaries[language][key]
      if (typeof value !== 'string' || !value.trim()) missing.push(`${language}: "${key}" (used in ${file})`)
    }
  }
  assert.deepEqual(missing, [], 'missing translations')
})

test('the five dictionaries have identical, non-empty key sets', () => {
  const keys = Object.keys(dictionaries.en).sort()
  assert.ok(keys.length > 570, `expected the full dictionary, found ${keys.length}`)
  for (const language of languages) {
    assert.deepEqual(Object.keys(dictionaries[language]).sort(), keys, language)
    const empty = keys.filter(key => !dictionaries[language][key].trim())
    assert.deepEqual(empty, [], `${language} has empty values`)
  }
  // Interpolation tokens must match across languages or a placeholder disappears.
  for (const key of keys) {
    const tokens = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort()
    for (const language of languages) {
      assert.deepEqual(tokens(dictionaries[language][key]), tokens(dictionaries.en[key]), `${language}: ${key}`)
    }
  }
})

test('the tax guide and the field hints are translated everywhere they are used', () => {
  const taxLines = readFileSync('src/lib/taxGuide.ts', 'utf8')
  // Region labels, guide sections, hints and the disclaimer live in data structures,
  // so the literal scanner above cannot see them; they are collected here instead.
  const dataKeys = [...taxLines.matchAll(/^\s*(?:title|taxRate|businessTaxNumber|customerTaxNumber|numbering|dates|legal|disclaimer):\s*'((?:[^'\\]|\\.)+)'/gm)].map(match => unescape(match[1]))
  const sectionTitles = [...taxLines.matchAll(/title:\s*(?:TAX_FIELD_HINTS|'[^']*')|section\(/g)]
  assert.ok(dataKeys.length > 8, `expected the guide data strings, found ${dataKeys.length}`)
  void sectionTitles
  const missing = dataKeys.filter(key => languages.some(language => !dictionaries[language][key]?.trim()))
  assert.deepEqual(missing, [], 'untranslated guide data')
})

test('no source file hard-codes a user-facing sentence outside the dictionaries', () => {
  // A cheap guard that catches the common mistake: a new Alert/confirm message or a
  // button label written inline instead of through t(). Sentences with two or more
  // words and a capital letter that never appear in the dictionary are suspicious.
  const allowed = new Set(['CACHE', 'Mozilla/5.0', 'node_modules', 'application/json'])
  const suspicious: string[] = []
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
      if (/console\.\w+\(/.test(line)) continue
      for (const literal of line.matchAll(/'((?:[^'\\]|\\.)+)'/g)) {
        const text = unescape(literal[1])
        if (text.length < 14 || !/^[A-Z][a-z]+ [a-z]/.test(text)) continue
        if (allowed.has(text)) continue
        if (text in dictionaries.en) continue
        if (/^(https?|application|text|image)\//.test(text)) continue
        suspicious.push(`${file}: ${text}`)
      }
    }
  }
  assert.deepEqual(suspicious, [])
})
