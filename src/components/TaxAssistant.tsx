import { useEffect, useRef, useState } from 'react'
import { ChevronDown, HelpingHand, Sparkles, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { guideFor, TAX_DISCLAIMER, TAX_REGION_LABEL, TAX_REGIONS } from '../lib/taxGuide'
import type { TaxRegion } from '../store/types'

/**
 * Offline tax assistant: a segmented region switch, the bundled guide and a
 * close button. It reads only static data, so it stays inside the shipped CSP
 * (`connect-src 'none'`) and needs no network permission.
 */

export function TaxRegionSwitch({ region, onChange, disabled }: { region: TaxRegion; onChange: (region: TaxRegion) => void; disabled?: boolean }) {
  const { t } = useI18n()
  return (
    <div role="group" aria-label={t('Tax region')} className="inline-flex rounded-lg border border-line-strong bg-canvas p-0.5">
      {TAX_REGIONS.map(value => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          aria-pressed={region === value}
          onClick={() => onChange(value)}
          className={`rounded-[6px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50 ${region === value ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {t(TAX_REGION_LABEL[value])}
        </button>
      ))}
    </div>
  )
}

export function TaxGuideBody({ region, compact }: { region: TaxRegion; compact?: boolean }) {
  const { t } = useI18n()
  const guide = guideFor(region)
  return (
    <div className="space-y-4">
      {guide.sections.map(section => (
        <section key={section.id}>
          <h3 className="text-[12.5px] font-bold text-ink">{t(section.title)}</h3>
          <ul className="mt-1.5 space-y-1">
            {section.bullets.map(bullet => (
              <li key={bullet} className="flex gap-2 text-[12.5px] leading-5 text-muted">
                <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                <span>{t(bullet)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[12px] text-muted">{t(TAX_DISCLAIMER)}</p>
      <p className="text-[11.5px] text-faint">{t('Last reviewed: {date}', { date: guide.lastReviewed })}</p>
      {!compact && <p className="text-[11.5px] text-faint">{t('Bundled with the app. The assistant never connects to the internet.')}</p>}
    </div>
  )
}

/** Small control shown where the panel would be while the assistant is hidden. */
export function ShowTaxAssistantButton({ onShow }: { onShow: () => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onShow}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-ink"
    >
      <Sparkles className="h-3.5 w-3.5" />{t('Show tax assistant')}
    </button>
  )
}

export interface TaxAssistantPanelProps {
  region: TaxRegion
  /** Switching here changes the assistant view only; the caller stores it separately. */
  onRegionChange: (region: TaxRegion) => void
  /** Copies the assistant region into Settings ("Use this region for new invoices"). */
  onApplyRegion: (region: TaxRegion) => void
  onHide: () => void
  /** First-ever view opens expanded, later views collapse. */
  startOpen: boolean
  /** Called once, the first time the panel is shown. */
  onFirstView?: () => void
}

export default function TaxAssistantPanel({ region, onRegionChange, onApplyRegion, onHide, startOpen, onFirstView }: TaxAssistantPanelProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(startOpen)
  // Keep the latest callback without re-running the one-shot mount effect.
  const firstView = useRef(onFirstView)
  firstView.current = onFirstView
  useEffect(() => { firstView.current?.() }, [])

  return (
    <div className="rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
          className="inline-flex items-center gap-2 text-start text-[13px] font-bold text-ink"
        >
          <HelpingHand className="h-4 w-4 text-brand" />{t('Tax assistant')}
          <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center gap-2">
          <TaxRegionSwitch region={region} onChange={onRegionChange} />
          <button type="button" onClick={onHide} aria-label={t('Hide tax assistant')} title={t('Hide tax assistant')} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-canvas">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line p-3.5">
          <TaxGuideBody region={region} compact />
          <button type="button" onClick={() => onApplyRegion(region)} className="mt-3 text-[12.5px] font-semibold text-brand hover:text-brand-700">
            {t('Use this region for new invoices')}
          </button>
        </div>
      )}
    </div>
  )
}
