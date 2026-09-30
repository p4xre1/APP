import { ArrowLeft } from 'lucide-react'
import { TaxGuideBody, TaxRegionSwitch } from '../components/TaxAssistant'
import { useI18n } from '../i18n'
import { assistantRegion, guideFor, settingsRegion, TAX_REGION_LABEL } from '../lib/taxGuide'
import { useFatorati } from '../store/useFatorati'
import type { TaxRegion } from '../store/types'

/** Full-screen tax guide, opened from Settings. Same bundled content, more room. */
export default function TaxGuide({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const { settings, updateSettings } = useFatorati()
  const region = assistantRegion(settings)
  const applied = settingsRegion(settings)
  const guide = guideFor(region)

  const switchRegion = (next: TaxRegion) => {
    // Region switch is view-only: it never rewrites the region used by documents.
    void updateSettings({ taxAssistantRegion: next }).catch(() => undefined)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Tax guide')}</h1>
          <p className="mt-1 text-[13px] text-muted">{t('Bundled offline guidance for invoices and tax.')}</p>
        </div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4 directional" />{t('Back to settings')}
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TaxRegionSwitch region={region} onChange={switchRegion} />
          <span className="text-[12px] text-muted">
            {region === applied
              ? t('New documents use {region}.', { region: t(TAX_REGION_LABEL[region]) })
              : t('Showing {region}. New documents still use the region from Settings.', { region: t(TAX_REGION_LABEL[region]) })}
          </span>
        </div>
        {region !== applied && (
          <button onClick={() => void updateSettings({ taxRegion: region, taxAssistantRegion: region }).catch(() => undefined)} className="mt-3 rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98]">
            {t('Use this region for new invoices')}
          </button>
        )}
        <div className="mt-5 border-t border-line pt-5">
          <TaxGuideBody region={region} />
          <p className="mt-4 text-[12px] text-faint">{t('{region} guidance, last reviewed {date}.', { region: t(TAX_REGION_LABEL[region]), date: guide.lastReviewed })}</p>
        </div>
      </div>
    </div>
  )
}
