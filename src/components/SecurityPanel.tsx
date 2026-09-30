import { Shield } from 'lucide-react'
import { askConfirm } from '../lib/dialogs'
import { t } from '../i18n'
import { useEffect, useState } from 'react'
import { normalizePin, createOrChangePin, enableBiometric, biometricAvailable, readMeta, lockVault, resetApp } from '../lib/vault'
import { useI18n, usePreferences, errorText } from '../i18n'
import { savePreferences } from '../lib/preferences'
import { clearExportCache, exportCacheCount } from '../lib/cache'
import { Capacitor } from '@capacitor/core'
export default function SecurityPanel(){
  const {t}=useI18n(),p=usePreferences(),[pin,setPin]=useState(''),[next,setNext]=useState(''),[repeat,setRepeat]=useState('')
  const [available,setAvailable]=useState(false),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const [cached,setCached]=useState(0)
  useEffect(()=>{void biometricAvailable().then(setAvailable).catch(()=>setAvailable(false));void readMeta().then(meta=>setEnabled(meta.biometric));void exportCacheCount().then(setCached).catch(()=>setCached(0))},[])
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn();setPin('');setNext('');setRepeat('');setMessage(t('Saved'))}catch(e){setMessage(errorText(e))}finally{setBusy(false)}}
  return <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2"><Shield className="w-5 h-5" />{t('Security')}</h2>
    <div className="space-y-3.5">
    <p className="text-[13px] text-warn">{t('PIN warning')}</p>
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Auto-lock')}</span><select aria-label={t('Auto-lock')} value={p.autoLock} onChange={e=>void savePreferences({autoLock:Number(e.target.value) as 0|1|5|15}).catch(e=>setMessage(errorText(e)))} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">{[0,1,5,15].map(value=><option key={value} value={value}>{t(`autoLock.${value}`)}</option>)}</select></label>
    <p className="text-[12px] text-muted">{t('Background always locks')}</p>
    <label className="flex items-center gap-2 min-h-12 text-[13px] text-ink"><input type="checkbox" checked={p.secureScreen} onChange={e=>void savePreferences({secureScreen:e.target.checked}).catch(e=>setMessage(errorText(e)))}/>{t('Block screenshots and recent-app previews')}</label>
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Current PIN')}</span><input type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={e=>setPin(normalizePin(e.target.value))} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"/></label>
    <button disabled={busy||!available} onClick={()=>void run(async()=>{await enableBiometric(pin,!enabled);setEnabled(!enabled)})} className="w-full bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50">{t(enabled?t("Disable biometrics"):t("Enable biometrics"))}</button>
    {!available&&<p className="text-[12px] text-muted">{t('Biometrics unavailable')}</p>}
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('New PIN')}</span><input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={next} onChange={e=>setNext(normalizePin(e.target.value))} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"/></label>
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Confirm PIN')}</span><input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={repeat} onChange={e=>setRepeat(normalizePin(e.target.value))} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"/></label>
    <button disabled={busy} onClick={()=>void run(async()=>{if(next!==repeat)throw new Error('PINs do not match');await createOrChangePin(next,pin);setEnabled(false)})} className="w-full bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t('Change PIN')}</button>
    <button onClick={lockVault} className="w-full bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium">{t('Lock now')}</button>
    {Capacitor.isNativePlatform()&&<div className="rounded-lg bg-canvas p-3">
      <p className="text-[12px] text-muted">{cached?t('{count} temporary export files are stored in the app cache.',{count:cached}):t('No temporary export files are stored.')}</p>
      <button disabled={busy||!cached} onClick={()=>void run(async()=>{const removed=await clearExportCache();setCached(await exportCacheCount());if(!removed)throw new Error('Operation failed')})} className="mt-2 bg-surface border border-line-strong text-ink px-3 py-1.5 rounded-lg text-[12.5px] disabled:opacity-50">{t('Clear temporary files')}</button>
    </div>}
    <button disabled={busy} onClick={async()=>{if(await askConfirm(t('Reset warning'))&&await askConfirm(t('Confirm permanent reset')))void run(async()=>{await resetApp();window.location.reload()})}} className="block text-serious text-[13px]">{t('Reset app')}</button>
    {message&&<p role="status" className="text-[13px]">{t(message)}</p>}
    </div>
  </div>
}
