import { Shield, ShieldCheck, Fingerprint, Camera, Clock, Trash2 } from 'lucide-react'
import { t } from '../i18n'
import { useEffect, useState } from 'react'
import { normalizePin, createOrChangePin, enableBiometric, biometricAvailable, readMeta, lockVault } from '../lib/vault'
import { PIN_MAX, PASSCODE_MAX, PASSCODE_MIN } from '../lib/secret'
import { useI18n, usePreferences, errorText } from '../i18n'
import { savePreferences } from '../lib/preferences'
import { formatDate } from '../lib/format'
import { useLastBackup } from '../lib/useLastBackup'
import { oldestTombstone } from '../lib/db'
import { TOMBSTONE_MAX_AGE_MS } from '../lib/schema'
import ResetFlow from './ResetFlow'

const field = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

function SecurityStatus() {
  const { t } = useI18n(), prefs = usePreferences()
  const { lastBackup, loaded } = useLastBackup()
  const [biometric, setBiometric] = useState(false)
  const [lock, setLock] = useState(false)
  const [oldest, setOldest] = useState<number | null>(null)
  useEffect(() => {
    void readMeta().then(meta => { setBiometric(meta.biometric); setLock(!!meta.salt) })
    void oldestTombstone().then(setOldest).catch(() => setOldest(null))
  }, [])
  const row = 'flex items-center justify-between gap-3 text-[13px]'
  const on = (value: boolean) => t(value ? 'On' : 'Off')
  const staleTombstone = oldest !== null && Date.now() - oldest > TOMBSTONE_MAX_AGE_MS
  return <div className="border border-line rounded-lg p-4 space-y-2.5">
    <p className="text-[13px] font-semibold text-ink flex items-center gap-2"><ShieldCheck className="w-4 h-4" />{t('Security status')}</p>
    <p className={row}><span className="flex items-center gap-2 text-muted"><Shield className="w-4 h-4" />{t('Lock enabled')}</span><span className="font-medium text-ink">{on(lock)}</span></p>
    <p className={row}><span className="flex items-center gap-2 text-muted"><Fingerprint className="w-4 h-4" />{t('Biometric unlock')}</span><span className="font-medium text-ink">{on(biometric)}</span></p>
    <p className={row}><span className="flex items-center gap-2 text-muted"><Camera className="w-4 h-4" />{t('Screenshot protection')}</span><span className="font-medium text-ink">{on(prefs.secureScreen)}</span></p>
    <p className={row}><span className="flex items-center gap-2 text-muted"><Clock className="w-4 h-4" />{t('Last backup')}</span><span className="font-medium text-ink">{!loaded ? t('Loading...') : lastBackup ? formatDate(lastBackup, true) : t('Never')}</span></p>
    <p className="text-[12px] text-warn flex items-start gap-2"><Trash2 className="w-4 h-4 mt-0.5 shrink-0" />{staleTombstone ? t('Deletions older than 180 days were dropped from your backups. A phone that has not synced since then may bring deleted records back.') : t('Deletions are shared with other phones for 180 days. A phone that has not synced for more than 180 days may bring deleted records back.')}</p>
  </div>
}

export default function SecurityPanel(){
  const {t}=useI18n(),p=usePreferences(),[pin,setPin]=useState(''),[next,setNext]=useState(''),[repeat,setRepeat]=useState('')
  const [available,setAvailable]=useState(false),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const [passcode,setPasscode]=useState(false)
  useEffect(()=>{void biometricAvailable().then(setAvailable).catch(()=>setAvailable(false));void readMeta().then(meta=>setEnabled(meta.biometric))},[])
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn();setPin('');setNext('');setRepeat('');setMessage(t('Saved'))}catch(e){setMessage(errorText(e))}finally{setBusy(false)}}
  const clean=(value:string)=>passcode?value.replace(/[^A-Za-z0-9]/g,''):normalizePin(value).replace(/[^0-9]/g,'')
  return <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2"><Shield className="w-5 h-5" />{t('Security')}</h2>
    <div className="space-y-3.5">
    <p className="text-[13px] text-warn">{t('PIN warning')}</p>
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Auto-lock')}</span><select aria-label={t('Auto-lock')} value={p.autoLock} onChange={e=>void savePreferences({autoLock:Number(e.target.value) as 0|1|5|15}).catch(e=>setMessage(errorText(e)))} className={field}>{[0,1,5,15].map(value=><option key={value} value={value}>{t(`autoLock.${value}`)}</option>)}</select></label>
    <p className="text-[12px] text-muted">{t('Background always locks')}</p>
    <label className="flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" checked={p.secureScreen} onChange={e=>void savePreferences({secureScreen:e.target.checked}).catch(e=>setMessage(errorText(e)))}/>{t('Block screenshots and recent-app previews')}</label>
    <SecurityStatus />
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Current PIN or passcode')}</span><input type="password" inputMode={passcode?'text':'numeric'} maxLength={passcode?PASSCODE_MAX:PIN_MAX} autoComplete="off" value={pin} onChange={e=>setPin(clean(e.target.value))} className={field}/></label>
    <button disabled={busy||!available} onClick={()=>void run(async()=>{await enableBiometric(pin,!enabled);setEnabled(!enabled)})} className="w-full bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50">{t(enabled?t("Disable biometrics"):t("Enable biometrics"))}</button>
    {!available&&<p className="text-[12px] text-muted">{t('Biometrics unavailable')}</p>}
    <div className="flex gap-2">
      <button type="button" onClick={()=>{setPasscode(false);setNext('');setRepeat('')}} className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border ${passcode?'border-line text-muted bg-surface':'border-brand/30 text-brand bg-brand-50'}`}>{t('Numeric PIN')}</button>
      <button type="button" onClick={()=>{setPasscode(true);setNext('');setRepeat('')}} className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border ${!passcode?'border-line text-muted bg-surface':'border-brand/30 text-brand bg-brand-50'}`}>{t('Passcode')}</button>
    </div>
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{passcode?t('New passcode'):t('New PIN')}</span><input type="password" inputMode={passcode?'text':'numeric'} maxLength={passcode?PASSCODE_MAX:PIN_MAX} autoComplete="new-password" value={next} onChange={e=>setNext(clean(e.target.value))} className={field}/></label>
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{passcode?t('Confirm passcode'):t('Confirm PIN')}</span><input type="password" inputMode={passcode?'text':'numeric'} maxLength={passcode?PASSCODE_MAX:PIN_MAX} autoComplete="new-password" value={repeat} onChange={e=>setRepeat(clean(e.target.value))} className={field}/></label>
    <p className="text-[12px] text-muted">{t('A PIN can be 6 to 12 digits. A passcode needs {min} letters or digits.', { min: PASSCODE_MIN })}</p>
    <button disabled={busy} onClick={()=>void run(async()=>{if(next!==repeat)throw new Error('PINs do not match');await createOrChangePin(next,pin);setEnabled(false)})} className="w-full bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t('Change PIN')}</button>
    <button onClick={lockVault} className="w-full bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium">{t('Lock now')}</button>
    <ResetFlow mode="settings" />
    {message&&<p role="status" className="text-[13px]">{t(message)}</p>}
    </div>
  </div>
}
