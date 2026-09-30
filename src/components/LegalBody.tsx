import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { useI18n } from '../i18n'
import { APP_VERSION } from '../lib/version'
import {
  applyPlaceholders, inlineTokens, legalBlocks, legalDocument, legalLastUpdated, legalOnlineUrl,
  type LegalInline, type LegalKind,
} from '../lib/legal'

/** Inline runs of one markdown line: bold, code, links. React escapes all text. */
function Inline({ value }: { value: string }) {
  return <>{inlineTokens(value).map((token: LegalInline, index) => {
    if (token.type === 'strong') return <strong key={index} className="font-semibold text-ink">{token.text}</strong>
    if (token.type === 'code') return <code key={index} className="rounded bg-canvas px-1 py-0.5 font-mono text-[12px] text-ink">{token.text}</code>
    if (token.type === 'link') {
      const external = !token.href.startsWith('mailto:')
      return <a key={index} href={token.href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        className="font-medium text-brand-700 underline underline-offset-2 transition-colors hover:text-brand">{token.text}</a>
    }
    return <span key={index}>{token.text}</span>
  })}</>
}

/**
 * The bundled privacy policy or terms of use, rendered from docs/legal/*.md.
 * The text is never copied into the source: it comes from the generated module,
 * and the placeholders the owner still has to fill in are labelled as such.
 */
export default function LegalBody({ kind }: { kind: LegalKind }) {
  const { t, language } = useI18n()
  const document = legalDocument(kind, language)
  const blocks = useMemo(() => legalBlocks(applyPlaceholders(document.text)), [document.text, language])
  const updated = legalLastUpdated(document.text)
  const online = legalOnlineUrl(kind)

  return <>
    {document.fallback && <p className="mb-4 rounded-lg bg-warn-50 p-3 text-[12.5px] text-warn">
      {t('This document is only available in English, French and Arabic, so the English text is shown.')}
    </p>}
    <article className="space-y-3.5">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          // The page owns the h1, so the document opens at h2 to keep one outline.
          return block.level === 1
            ? <h2 key={index} className="text-[18px] font-bold tracking-tight text-ink">{block.text}</h2>
            : <h3 key={index} className="text-[15px] font-bold tracking-tight text-ink">{block.text}</h3>
        }
        if (block.type === 'list') return <ul key={index} className="list-disc space-y-2 ps-5 text-[13px] leading-relaxed text-ink">
          {block.items.map((item, position) => <li key={position}><Inline value={item} /></li>)}
        </ul>
        if (block.type === 'table') return <div key={index} className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-[12.5px]">
            <thead><tr>{block.head.map((cell, position) => <th key={position} scope="col" className="border-b border-line pb-2 pe-3 text-start font-semibold text-ink"><Inline value={cell} /></th>)}</tr></thead>
            <tbody>{block.rows.map((row, position) => <tr key={position}>{row.map((cell, column) => <td key={column} className="border-b border-line py-2 pe-3 align-top text-muted"><Inline value={cell} /></td>)}</tr>)}</tbody>
          </table>
        </div>
        return <p key={index} className="text-[13px] leading-relaxed text-ink"><Inline value={block.text} /></p>
      })}
    </article>
    <div className="mt-5 space-y-3 border-t border-line pt-4">
      <p className="text-[12px] text-muted">
        {t('Last updated')}: {updated.value ?? t('Date not set')} · {t('Version')} {APP_VERSION}
      </p>
      {online && <a href={online} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand-50 px-3.5 py-2 text-[13px] font-medium text-brand-700 transition-colors hover:bg-brand-100">
        <span>{t('Open online version')}</span>
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
      </a>}
      {online && <p className="text-[11.5px] text-muted">{t('Opens in your browser')}</p>}
    </div>
  </>
}
