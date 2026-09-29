import { FileLock2, FolderOpen, Copy, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n, errorText } from '../i18n'
import { showAlert } from '../lib/dialogs'
import { chooseExportFile, subscribePickedExport, takePickedExport } from '../lib/backup-picker'
import { decodeProtectedExport, ExportPasswordRequiredError, EXPORT_EXTENSION } from '../lib/export-crypto'
import { shareFile } from '../lib/share-file'
import { copyToClipboard } from '../lib/clipboard'

interface Opened { filename: string; kind: 'csv' | 'pdf'; preview: string; payload: string | Uint8Array<ArrayBuffer> }
const field = 'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

/** Opens a .fatorati-export file that was protected with a password. */
export default function ProtectedExportPanel() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<Opened | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    return subscribePickedExport(() => { const picked = takePickedExport(); if (picked) { setFile(picked); setResult(null); setPassword('') } })
  }, [open])

  async function decrypt() {
    if (!file) return
    setBusy(true); setMessage('')
    try {
      const { header, payload } = await decodeProtectedExport(await file.text(), password)
      setResult({
        filename: header.filename, kind: header.kind, payload,
        preview: header.kind === 'csv' && typeof payload === 'string' ? payload.split('\r\n').slice(0, 6).join('\n') : '',
      })
    } catch (error) {
      setResult(null)
      setMessage(error instanceof ExportPasswordRequiredError ? t(error.message) : errorText(error))
    } finally { setBusy(false) }
  }

  if (!open) return <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <button onClick={() => setOpen(true)} className="w-full flex items-center justify-between gap-2 text-[14px] font-bold text-ink">
      <span className="flex items-center gap-2"><FileLock2 className="w-5 h-5" />{t('Open protected export')}</span>
      <FolderOpen className="w-4 h-4" />
    </button>
  </div>

  return <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2"><FileLock2 className="w-5 h-5" />{t('Open protected export')}</h2>
    <div className="space-y-3.5">
      <p className="text-[13px] text-muted">{t('Decrypt a CSV or PDF that you exported with a password. The file stays on this phone.')}</p>
      <button onClick={() => chooseExportFile()} className="w-full bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2">
        <FolderOpen className="w-4 h-4" />{file ? file.name : t(`Choose a ${EXPORT_EXTENSION} file`)}
      </button>
      <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Export password')}</span>
        <input type="password" autoComplete="off" disabled={!file || busy} value={password} onChange={e => setPassword(e.target.value)} className={field} /></label>
      <div className="flex gap-2">
        <button disabled={!file || busy} onClick={() => void decrypt()} className="flex-1 bg-brand hover:bg-brand-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold">{busy ? t('Working...') : t('Decrypt')}</button>
        <button onClick={() => { setOpen(false); setFile(null); setResult(null); setMessage('') }} className="bg-canvas px-4 py-2 rounded-lg text-[13px]">{t('Cancel')}</button>
      </div>
      {result && <div className="space-y-3.5">
        <p className="text-[13px] text-ink">{t('Decrypted: {name}', { name: result.filename })}</p>
        {result.preview && <pre className="max-h-40 overflow-auto text-[12px] text-muted bg-canvas rounded-lg p-3 whitespace-pre-wrap">{result.preview}</pre>}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void shareFile(result.filename, result.payload, result.kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/pdf')} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2"><Share2 className="w-4 h-4" />{t('Save or share')}</button>
          {result.kind === 'csv' && <button onClick={() => void copyToClipboard(typeof result.payload === 'string' ? result.payload : '').then(() => showAlert(t('Copied to clipboard. It is cleared when the app locks.')))} className="bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2"><Copy className="w-4 h-4" />{t('Copy')}</button>}
        </div>
      </div>}
      {message && <p role="alert" className="text-[13px] text-serious">{message}</p>}
    </div>
  </div>
}
