import { chooseBackupFile, subscribePickedBackup, takePickedBackup } from '../lib/backup-picker'
import { isUnlocked } from '../lib/vault'
import { showAlert, askConfirm } from '../lib/dialogs'
import { errorText } from '../i18n'
import { t } from '../i18n'
import { formatDate } from '../lib/format'
import { useEffect, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useFatorati } from '../store/useFatorati'
import { loadBackupFile } from '../lib/db'
import { PasswordRequiredError, MIN_PASSWORD_LENGTH } from '../lib/backup-format'
import type { ImportMode } from '../lib/backup-format'
import { useLastBackup } from '../lib/useLastBackup'

export default function BackupPanel() {
  const { exportBackup, importBackup } = useFatorati()
  const { lastBackup, loaded, error } = useLastBackup()
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const [message, setMessage] = useState('')
  const inputClass = 'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  useEffect(() => {
    const receive = () => {
      if (!isUnlocked()) return
      const selection = takePickedBackup()
      if (selection) { setMode(selection.mode); void handleImport(selection.file, undefined, selection.mode) }
    }
    receive()
    return subscribePickedBackup(receive)
  }, [])

  async function handleExport() {
    if (!password) { setMessage(t("A backup password is required while app lock is enabled")); return }
    if (password.length < MIN_PASSWORD_LENGTH) { setMessage(t("Backup password is too short")); return }
    if (password !== confirmation) { setMessage(t("Export passwords do not match.")); return }
    setBusy(true); setMessage('')
    try {
      await exportBackup(password)
      setPassword(''); setConfirmation('')
      setMessage(t("Backup handed off. Make sure the receiving app saves or sends the file."))
    } catch (error) {
      setMessage(t('Export not completed') + ': ' + (errorText(error)))
    } finally { setBusy(false) }
  }

  async function handleImport(file: File, secret?: string, selectedMode: ImportMode = mode) {
    setBusy(true); setMessage('')
    try {
      // Parse, decrypt and validate before even offering a destructive confirmation.
      const backup = await loadBackupFile(file, secret)
      if (selectedMode === 'replace' && !await askConfirm(t("Replace ALL data on this phone? All current businesses, customers, projects, invoices, estimates, expenses, products and settings will be deleted and replaced by this backup. Export your current data first. Continue?"))) return
      const summary = await importBackup(backup, selectedMode)
      setPendingFile(null); setImportPassword('')
      await showAlert(t('Import summary', { added: summary.added, updated: summary.updated, skipped: summary.skipped }))
      window.location.reload()
    } catch (error) {
      if (error instanceof PasswordRequiredError) {
        setPendingFile(file); setImportPassword('')
        setMessage(error.message)
      } else {
        setMessage(t('Import failed') + ': ' + (errorText(error)))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="backup-panel" className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2"><Download className="w-5 h-5" />{t("Backup & Restore")}</h2>
      <p className="text-[13px] text-muted mb-3">{t("Your data lives only on this phone. Uninstalling the app deletes it. Export a backup regularly.")}</p>
      <p className="text-[12px] text-muted mb-4">{t("Last backup date:")}{!loaded ? t("Loading...") : error ? t("Unavailable") : lastBackup ? formatDate(lastBackup,true) : t("Never")}</p>
      <div className="space-y-4">
        <div className="bg-brand-50 border border-brand/20 rounded-lg p-4">
          <h3 className="font-medium text-ink text-[13px]">{t("Export Backup")}</h3>
          <p className="text-[12px] text-brand-700 mt-1">{t("Your backup is password-protected. Save it outside this phone.")}</p>
          <div className="mt-3 space-y-4">
          <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Backup password")}</span><input type="password" autoComplete="new-password" disabled={busy} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
          </label>
          {password && <>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Confirm password")}</span><input type="password" autoComplete="new-password" disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass} />
            </label>
            <p className="text-[12px] text-brand-700">{t("Keep this password safe. A forgotten password cannot be recovered.")}</p>
          </>}
          <button onClick={handleExport} disabled={busy || !!pendingFile} className="w-full bg-brand hover:bg-brand-700 disabled:bg-line-strong text-white py-2.5 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
            <Download className="w-4 h-4" />{busy ? t("Working...") : t("Export Backup .fatorati")}
          </button>
          </div>
        </div>
        <div className="bg-warn-50 border border-warn/20 rounded-lg p-4">
          <h3 className="font-medium text-warn text-[13px]">{t("Import Backup")}</h3>
          <div className="mt-3 space-y-4">
          <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Import mode")}</span><select aria-label={t('Import mode')} value={mode} disabled={busy || !!pendingFile} onChange={e => setMode(e.target.value as ImportMode)} className={inputClass}>
              <option value="merge">{t("Merge / Sync")}</option>
              <option value="replace">{t("Replace all data")}</option>
            </select>
          </label>
          <p className="text-[12px] text-warn">{mode === 'merge' ? t("Match by ID and keep the newer updatedAt. Local records are never deleted; ties keep the local record. Keep both phones’ clocks accurate. To sync both ways, export the merged data back to the other phone.") : t("Deletes all current data and restores the backup. You will be asked to confirm.")}</p>
          {!pendingFile ? <button onClick={() => chooseBackupFile(mode)} disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-line-strong text-white py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />{busy ? t("Working...") : t("Import Backup")}
          </button> : <form onSubmit={e => { e.preventDefault(); void handleImport(pendingFile, importPassword) }} className="space-y-4">
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Backup password")}</span><input autoFocus type="password" autoComplete="off" disabled={busy} value={importPassword} onChange={e => setImportPassword(e.target.value)} className={inputClass} />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="bg-amber-600 disabled:bg-line-strong text-white px-4 py-2 rounded-lg text-[13px]">{t("Decrypt & Import")}</button>
              <button type="button" disabled={busy} onClick={() => { setPendingFile(null); setImportPassword(''); setMessage('') }} className="bg-canvas px-4 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
            </div>
          </form>}
          </div>
        </div>
        {message && <p role="status" className="text-[13px] text-ink break-words">{t(message)}</p>}
      </div>
    </div>
  )
}
