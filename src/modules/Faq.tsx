import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, Search } from 'lucide-react'
import { useI18n } from '../i18n'
import { FAQ_ITEMS, FAQ_TOPIC_LABEL, FAQ_TOPICS, filterFaq } from '../lib/faq'

/**
 * Searchable FAQ. The questions and the answers live in src/lib/faq.ts and are
 * translated in all five languages, so the search runs on the text the user reads.
 */
export default function Faq({ onBack }: { onBack: () => void }) {
  const { t, language } = useI18n()
  const [query, setQuery] = useState('')
  const found = useMemo(() => filterFaq(query, t), [query, language])
  const groups = FAQ_TOPICS
    .map(topic => ({ topic, items: found.filter(item => item.topic === topic) }))
    .filter(group => group.items.length > 0)

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('FAQ')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('Short answers about how this build behaves. Everything is offline.')}</p>
      </div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4 directional" />{t('Back to help')}
      </button>
    </div>

    <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={t('Search the FAQ')} placeholder={t('Search the FAQ')}
          className="w-full rounded-lg border border-line-strong bg-surface py-2 pe-3 ps-9 text-[13.5px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
      </div>
      {found.length === 0 && <p role="status" className="mt-3 text-[13px] text-muted">{t('No answer matches your search.')}</p>}
    </div>

    {groups.map(group => <section key={group.topic} className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[14px] font-bold text-ink">{t(FAQ_TOPIC_LABEL[group.topic])}</h2>
      <ul className="mt-2 divide-y divide-line">
        {group.items.map(item => <li key={item.id}>
          <details className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[13.5px] font-medium text-ink">
              <span>{t(item.question)}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="pb-3 pe-3 text-[13px] leading-relaxed text-muted">{t(item.answer)}</p>
          </details>
        </li>)}
      </ul>
    </section>)}
  </div>
}
