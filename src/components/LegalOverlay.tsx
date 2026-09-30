import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import LegalBody from './LegalBody'
import { useI18n } from '../i18n'
import { LEGAL_TITLE, type LegalKind } from '../lib/legal'

/**
 * The privacy policy and the terms on the screens that run before the app does
 * (onboarding and PIN setup), so they can be read before anything is entered.
 * A modal dialog, so the app behind it stays inert until it is closed.
 */
export default function LegalOverlay({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])

  return <dialog ref={dialog} aria-label={t(LEGAL_TITLE[kind])} onCancel={event => { event.preventDefault(); onClose() }}
    className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 bg-canvas p-0 text-ink backdrop:bg-navy/50">
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold tracking-tight text-ink">{t(LEGAL_TITLE[kind])}</h2>
        <button autoFocus onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4 directional" />{t('Close')}
        </button>
      </div>
      <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <LegalBody kind={kind} />
      </div>
    </div>
  </dialog>
}
