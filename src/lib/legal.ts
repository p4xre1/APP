import {
  LEGAL_DOCUMENT_LANGUAGES, LEGAL_TEXT, LEGAL_SOURCE_FILES,
  type LegalDocumentLanguage, type LegalKind,
} from './legal-content.generated'

export { LEGAL_SOURCE_FILES, LEGAL_TEXT }
import { privacyPolicyUrl, supportEmail, termsUrl } from './appConfig'
import { t } from '../i18n'

export { LEGAL_DOCUMENT_LANGUAGES }
export type { LegalDocumentLanguage, LegalKind }

/** Translation keys for the two documents; the labels the About card already uses. */
export const LEGAL_TITLE: Record<LegalKind, string> = {
  privacy: 'Privacy policy',
  terms: 'Terms of use',
}

/**
 * docs/legal ships English, French and Arabic while the interface has five
 * languages. es/pt therefore read the English document with a translated notice
 * instead of a machine translation nobody reviewed.
 */
export function legalTranslation(language: string): { language: LegalDocumentLanguage; fallback: boolean } {
  const bundled = LEGAL_DOCUMENT_LANGUAGES.includes(language as LegalDocumentLanguage)
  return { language: bundled ? language as LegalDocumentLanguage : 'en', fallback: !bundled }
}

/** The bundled document for one language, plus what was actually returned. */
export function legalDocument(kind: LegalKind, language: string) {
  const { language: resolved, fallback } = legalTranslation(language)
  return { text: LEGAL_TEXT[kind][resolved], language: resolved, fallback, file: LEGAL_SOURCE_FILES[kind][resolved] }
}

/** `## ` headings, in order. The tests use them to catch a missing section. */
export function legalSections(text: string): string[] {
  return text.split('\n').filter(line => line.startsWith('## ')).map(line => line.slice(3).trim())
}

/**
 * The date the document states in its own header. The markdown keeps the owner's
 * `[LAST UPDATED]` placeholder until the policy is published, so the app shows a
 * translated "not set" instead of inventing a date.
 */
export function legalLastUpdated(text: string): { value: string | null; pending: boolean } {
  const match = /^\*\*(?:Last updated|Dernière mise à jour|آخر تحديث)\s*:\s*(.+?)\*\*/m.exec(text)
  const value = match?.[1].trim() ?? null
  return { value: value && !value.includes('LAST UPDATED') ? value : null, pending: !value || value.includes('LAST UPDATED') }
}

/**
 * Replaces the two owner placeholders the documents carry. Everything else in the
 * markdown is rendered verbatim: the screens never copy or rewrite the text.
 */
export function applyPlaceholders(text: string, email = supportEmail()): string {
  return text
    .replace(/\[SUPPORT EMAIL\]/g, email ? `[${email}](mailto:${email})` : t('Support address not published yet'))
    .replace(/\[LAST UPDATED\]/g, t('Date not set'))
}

/** The "Open online version" row only exists when the owner configured an URL. */
export function legalOnlineUrl(kind: LegalKind): string | null {
  return kind === 'privacy' ? privacyPolicyUrl() : termsUrl()
}

export type LegalInline =
  | { type: 'text' | 'strong' | 'code'; text: string }
  | { type: 'link'; text: string; href: string }

export type LegalBlock =
  | { type: 'heading'; level: 1 | 2; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }

/** Only these schemes become links; a relative path renders as plain label text. */
export const SAFE_LINK = /^(https?:\/\/|mailto:)[^\s]+$/i

/**
 * Splits one line of markdown into text, bold, code and link runs. No HTML is
 * ever produced from the document: React escapes every string it renders.
 */
export function inlineTokens(text: string): LegalInline[] {
  const tokens: LegalInline[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g
  let index = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > index) tokens.push({ type: 'text', text: text.slice(index, start) })
    const token = match[0]
    if (token.startsWith('**')) tokens.push({ type: 'strong', text: token.slice(2, -2) })
    else if (token.startsWith('`')) tokens.push({ type: 'code', text: token.slice(1, -1) })
    else {
      const label = token.slice(1, token.indexOf(']'))
      const href = token.slice(token.indexOf('](') + 2, -1)
      tokens.push(SAFE_LINK.test(href) ? { type: 'link', text: label, href } : { type: 'text', text: label })
    }
    index = start + token.length
  }
  if (index < text.length) tokens.push({ type: 'text', text: text.slice(index) })
  return tokens.length ? tokens : [{ type: 'text', text }]
}

const tableCells = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
/** The `|---|---|` divider row of a markdown table. */
const isSeparator = (line: string) => /^[\s|:-]*-[\s|:-]*$/.test(line)

/** Converts the small markdown subset the legal documents use into blocks. */
export function legalBlocks(text: string): LegalBlock[] {
  const blocks: LegalBlock[] = []
  const lines = text.split('\n')
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) { flush(); continue }
    const heading = /^(#{1,2})\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2, text: heading[2].trim() })
      continue
    }
    if (line.startsWith('|')) {
      flush()
      const rows: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        if (!isSeparator(lines[index].trim())) rows.push(lines[index].trim())
        index += 1
      }
      index -= 1
      const [head, ...body] = rows.map(tableCells)
      if (head) blocks.push({ type: 'table', head, rows: body })
      continue
    }
    if (line.startsWith('- ')) {
      flush()
      const items: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        let item = lines[index].trim().slice(2).trim()
        // Continuation lines are indented; they belong to the previous bullet.
        while (index + 1 < lines.length && /^\s{2,}\S/.test(lines[index + 1]) && !lines[index + 1].trim().startsWith('- ')) {
          index += 1
          item += ` ${lines[index].trim()}`
        }
        items.push(item)
        index += 1
      }
      index -= 1
      blocks.push({ type: 'list', items })
      continue
    }
    paragraph.push(line)
  }
  flush()
  return blocks
}
