import { AlertTriangle, Download, Timer, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n, errorText } from '../i18n'
import { askConfirm, showAlert } from '../lib/dialogs'
import { getResetStatus, requestAppReset, cancelAppReset, resetApp, resetAppFromSettings, resetWord } from '../lib/vault'
import { RESET_WAIT_MS } from '../lib/reset'

const field = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

/**
 * A reset requested from the lock screen needs a typed word plus a 24 hour wait; from
 * Settings it needs the current secret and the same word, with no wait at all.
 */
export default function ResetFlow({ mode }: { mode: 'lock' | 'settings' }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [secret, setSecret] = useState('')
  const [status, setStatus] = useState<{ pending: boolean; left: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [, setTick] = useState(0)
  const startedAt = useRef(0)

  useEffect(() => {
    if (!open) return
    void getResetStatus().then(value => {
      startedAt.current = Date.now()
      setStatus({ pending: !!value.request, left: value.remainingMs })
    }).catch(() => setStatus({ pending: false, left: 0 }))
    const timer = setInterval(() => setTick(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [open])

  const left = status ? Math.max(0, status.left - (Date.now() - startedAt.current)) : 0
  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true); setMessage(''); setWord(''); setSecret('')
    try { await action(); if (success) setMessage(t(success)) }
    catch (error) { setMessage(errorText(error)) }
    finally { setBusy(false) }
  }
  async function exportFirst() {
    if (mode === 'lock') return showAlert(t('Unlock with your PIN first, then export a backup from Settings. Unlocking also cancels this reset.'))
    document.getElementById('backup-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    await showAlert(t('Export a backup from the panel above first, then come back to erase everything.'))
  }
  async function erase() {
    if (!await askConfirm(t('Confirm permanent reset'))) return
    await run(async () => {
      if (mode === 'lock') await resetApp(word)
      else await resetAppFromSettings(secret, word)
      window.location.reload()
    })
  }
  const button = 'w-full px-3.5 py-2 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2'
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="block text-serious text-[13px]">{t('Reset app')}</button>
  return <div className="space-y-3.5 border border-serious/30 bg-serious/5 rounded-lg p-4">
    <p className="text-[13px] text-ink flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{t('Reset warning')}</p>
    <button type="button" onClick={() => void exportFirst()} className={`${button} bg-canvas text-ink`}><Download className="w-4 h-4" />{t('Export backup first')}</button>
    <label className="block">
      <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Type {word} to confirm', { word: resetWord() })}</span>
      <input type="text" autoComplete="off" value={word} onChange={e => setWord(e.target.value)} className={field} />
    </label>
    {mode === 'settings' && <label className="block">
      <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Current PIN or passcode')}</span>
      <input type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} className={field} />
    </label>}
    {mode === 'lock' && <>
      <p className="text-[12px] text-muted">{t('A reset requested from the lock screen starts a {hours} hour wait, and unlocks cancel it.', { hours: RESET_WAIT_MS / 3600_000 })}</p>
      {!status?.pending && <button type="button" disabled={busy || !status} onClick={() => void run(async () => {
        await requestAppReset(word)
        startedAt.current = Date.now()
        setStatus({ pending: true, left: RESET_WAIT_MS })
      })} className={`${button} bg-canvas text-ink`}>{t('Start the 24 hour wait')}</button>}
      {status?.pending && left > 0 && <div className="space-y-3.5">
        <p role="status" className="text-[13px] text-ink flex items-center gap-2"><Timer className="w-4 h-4" />{t('Reset in {days}d {hours}h {minutes}m {seconds}s', { days: Math.floor(left / 86400_000), hours: Math.floor(left / 3600_000) % 24, minutes: Math.floor(left / 60_000) % 60, seconds: Math.floor(left / 1000) % 60 })}</p>
        <p className="text-[12px] text-muted">{t('Unlocking with your PIN cancels this reset.')}</p>
        <button type="button" disabled={busy} onClick={() => void run(async () => { await cancelAppReset(); setStatus({ pending: false, left: 0 }) }, 'Reset cancelled')} className={`${button} bg-canvas text-ink`}><XCircle className="w-4 h-4" />{t('Cancel reset')}</button>
      </div>}
      {status?.pending && left === 0 && <button type="button" disabled={busy} onClick={() => void erase()} className="w-full bg-serious text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40">{t('Erase everything now')}</button>}
    </>}
    {mode === 'settings' && <button type="button" disabled={busy} onClick={() => void erase()} className="w-full bg-serious text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40">{t('Erase everything now')}</button>}
    {message && <p role="alert" className="text-serious text-[13px]">{message}</p>}
    <button type="button" onClick={() => { setOpen(false); setMessage('') }} className="text-[13px] text-muted">{t('Cancel')}</button>
  </div>
}
