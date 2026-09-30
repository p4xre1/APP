import { ArrowLeft } from 'lucide-react'
import LegalBody from '../components/LegalBody'
import { useI18n } from '../i18n'
import { LEGAL_TITLE, type LegalKind } from '../lib/legal'

/** Full-screen privacy policy or terms of use, opened from Settings. */
export default function LegalDocument({ kind, onBack }: { kind: LegalKind; onBack: () => void }) {
  const { t } = useI18n()
  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t(LEGAL_TITLE[kind])}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('Bundled offline. This is the full text, not a summary.')}</p>
      </div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4 directional" />{t('Back to settings')}
      </button>
    </div>
    <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <LegalBody kind={kind} />
    </div>
  </div>
}
