#!/usr/bin/env node
/**
 * Fatorati - legal text generator.
 *
 * `docs/legal/<kind>.<language>.md` is the single source of truth for the text
 * the app shows on the Privacy policy and Terms of use screens. This script
 * copies those files verbatim into a TypeScript module, so the app never keeps a
 * hand-maintained second copy that can drift from the published documents:
 *
 *     node scripts/legal-content.mjs
 *
 * `pnpm build` runs the generator first, and `tests/help-legal.test.ts` fails if
 * the committed module differs from the markdown by a single byte.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Documents the app bundles. */
export const LEGAL_KINDS = ['privacy', 'terms']
/** Languages `docs/legal` ships. The interface has five, so es/pt fall back to en. */
export const LEGAL_LANGUAGES = ['en', 'fr', 'ar']
/** One line per file, so the source of every string stays traceable. */
export const OUTPUT_FILE = 'src/lib/legal-content.generated.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Reads every document from disk: { privacy: { en: '...', fr: '...' }, ... }. */
export function legalSources(repository = root) {
  const read = (kind, language) =>
    readFileSync(join(repository, 'docs', 'legal', `${kind}.${language}.md`), 'utf8')
  return Object.fromEntries(
    LEGAL_KINDS.map(kind => [kind, Object.fromEntries(LEGAL_LANGUAGES.map(language => [language, read(kind, language)]))]),
  )
}

/** The exact text of the generated module; exported so tests can compare it. */
export function renderModule(sources) {
  const body = kind =>
    LEGAL_LANGUAGES
      .map(language => `    ${language}: ${JSON.stringify(sources[kind][language])},`)
      .join('\n')
  const files = kind =>
    LEGAL_LANGUAGES
      .map(language => `    ${language}: 'docs/legal/${kind}.${language}.md',`)
      .join('\n')
  return `/**
 * GENERATED FILE - do not edit.
 *
 * Written by scripts/legal-content.mjs from docs/legal/*.md, which is the single
 * source of truth for the in-app legal text. Edit the markdown, then run
 * \`pnpm legal:build\` (the build does it too). tests/help-legal.test.ts fails if
 * this file and the markdown disagree.
 */
export type LegalKind = ${LEGAL_KINDS.map(kind => `'${kind}'`).join(' | ')}
export type LegalDocumentLanguage = ${LEGAL_LANGUAGES.map(language => `'${language}'`).join(' | ')}

/** Languages the bundled documents exist in. Order is the fallback order. */
export const LEGAL_DOCUMENT_LANGUAGES: LegalDocumentLanguage[] = [${LEGAL_LANGUAGES.map(language => `'${language}'`).join(', ')}]

/** The documents, verbatim. Never hand-edit or copy one of these strings. */
export const LEGAL_TEXT: Record<LegalKind, Record<LegalDocumentLanguage, string>> = {
  ${LEGAL_KINDS.map(kind => `${kind}: {\n${body(kind)}\n  },`).join('\n  ')}
}

/** Where each bundled document comes from, for the tests and for review. */
export const LEGAL_SOURCE_FILES: Record<LegalKind, Record<LegalDocumentLanguage, string>> = {
  ${LEGAL_KINDS.map(kind => `${kind}: {\n${files(kind)}\n  },`).join('\n  ')}
}
`
}

export function writeModule(repository = root) {
  const target = join(repository, OUTPUT_FILE)
  writeFileSync(target, renderModule(legalSources(repository)))
  return target
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = writeModule()
  console.log(`legal text written to ${OUTPUT_FILE} from ${LEGAL_KINDS.length} documents x ${LEGAL_LANGUAGES.length} languages (${target})`)
}
