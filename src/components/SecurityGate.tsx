import { Shield } from 'lucide-react'
import { askConfirm } from '../lib/dialogs'
import { t } from '../i18n'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { normalizePin, createOrChangePin, unlockPin, unlockBiometric, lockVault, isUnlocked, subscribeLock, readMeta, resetApp } from '../lib/vault'
import { applyImportedPreferences } from '../lib/db'
import { usePreferences, useI18n, errorText } from '../i18n'
import { number } from '../lib/format'
import LanguagePicker from './LanguagePicker'
import LegalOverlay from './LegalOverlay'
import type { LegalKind } from '../lib/legal'
import { useFatorati } from '../store/useFatorati'

export default function SecurityGate({ children }: {children:ReactNode}) {
  const {t}=useI18n(),prefs=usePreferences(),unlocked=useSyncExternalStore(subscribeLock,isUnlocked)
  const [configured,setConfigured]=useState<boolean|null>(null),[biometric,setBiometric]=useState(false)
  const [pin,setPin]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [blocked,setBlocked]=useState(0),[clock,setClock]=useState(Date.now()),[ready,setReady]=useState(false)
  const [legal,setLegal]=useState<LegalKind|null>(null)
  const refresh=async()=>{const meta=await readMeta();setConfigured(!!meta.salt);setBiometric(meta.biometric);setBlocked(meta.blockedUntil)}
  useEffect(()=>{void refresh().catch(e=>setError(errorText(e)))},[unlocked])
  useEffect(()=>{
    const clear=()=>{setPin('');setRepeat('');setReady(false);useFatorati.setState({business:null,customers:[],projects:[],invoices:[],estimates:[],expenses:[],products:[],subscriptions:[],settings:null,isLoading:true,isOnboarded:false,loadError:null})}
    return subscribeLock(()=>{if(!isUnlocked())clear()})
  },[])
  useEffect(()=>{
    if(!unlocked) return
    let active=true
    void applyImportedPreferences().then(()=>{if(active&&isUnlocked())setReady(true)}).catch(e=>{lockVault();setError(errorText(e))})
    return()=>{active=false}
  },[unlocked])
  useEffect(()=>{
    let last=Date.now()
    const activity=()=>{last=Date.now()}
    const background=()=>{if(document.visibilityState==='hidden')lockVault()}
    for(const event of ['pointerdown','keydown','touchstart']) window.addEventListener(event,activity,{passive:true})
    document.addEventListener('visibilitychange',background)
    // Immediately means no foreground idle grace; background always locks regardless of timeout.
    const timer=setInterval(()=>{setClock(Date.now());if(isUnlocked()&&prefs.autoLock>0&&Date.now()-last>=prefs.autoLock*60_000)lockVault()},1000)
    const handle=Capacitor.isNativePlatform()?NativeApp.addListener('appStateChange',({isActive})=>{if(!isActive)lockVault();else last=Date.now()}):null
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',background);for(const event of ['pointerdown','keydown','touchstart'])window.removeEventListener(event,activity);void handle?.then(h=>h.remove())}
  },[prefs.autoLock])
  async function submit(useBiometric=false){
    setBusy(true);setError('')
    try {
      if(configured) {if(useBiometric)await unlockBiometric();else await unlockPin(pin)}
      else {if(pin!==repeat)throw new Error('PINs do not match');await createOrChangePin(pin)}
      setPin('');setRepeat('')
    }catch(e){setError(errorText(e));await refresh()}
    finally{setBusy(false)}
  }
  async function reset(){
    if(!await askConfirm(t('Reset warning')))return
    if(!await askConfirm(t('Confirm permanent reset')))return
    setBusy(true)
    try{await resetApp();window.location.reload()}catch(e){setError(errorText(e));setBusy(false)}
  }
  if(unlocked&&ready)return <>{children}</>
  return <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
    <div className="bg-surface rounded-xl border border-line p-5 max-w-md w-full shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h1 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2"><Shield className="w-5 h-5" />{t(configured?t("Unlock Fatorati"):t("Create your PIN"))}</h1>
      <div className="space-y-3.5">
      <LanguagePicker />
      {!configured&&<p className="text-[13px] text-warn">{t('PIN warning')}</p>}
      <form onSubmit={e=>{e.preventDefault();void submit()}} className="space-y-3.5">
        <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('6-digit PIN')}</span><input autoFocus aria-label={t('6-digit PIN')} type="password" inputMode="numeric" autoComplete="off" maxLength={6} pattern="[0-9]{6}" required value={pin} onChange={e=>setPin(normalizePin(e.target.value).replace(/[^0-9]/g,''))} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
        {configured===false&&<label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Confirm PIN')}</span><input type="password" inputMode="numeric" autoComplete="off" maxLength={6} required value={repeat} onChange={e=>setRepeat(normalizePin(e.target.value).replace(/[^0-9]/g,''))} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>}
        <button disabled={busy||configured===null||blocked>clock} className="w-full bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t(busy?t("Working..."):configured?t("Unlock"):t("Create PIN"))}</button>
      </form>
      {biometric&&<button disabled={busy||blocked>clock} onClick={()=>void submit(true)} className="w-full bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium">{t('Use biometrics')}</button>}
      {blocked>clock&&<p role="status">{t('Wait seconds',{count:number(Math.ceil((blocked-clock)/1000))})}</p>}
      {error&&<p role="alert" className="text-serious text-[13px]">{t(error)}</p>}
      <button disabled={busy} onClick={()=>void reset()} className="text-serious text-[13px]">{t('Reset app')}</button>
      <div className="flex flex-wrap items-center gap-x-4">
        <button type="button" onClick={()=>setLegal('privacy')} className="min-h-12 text-[12px] font-medium text-muted underline underline-offset-2 transition-colors hover:text-ink">{t('Privacy policy')}</button>
        <button type="button" onClick={()=>setLegal('terms')} className="min-h-12 text-[12px] font-medium text-muted underline underline-offset-2 transition-colors hover:text-ink">{t('Terms of use')}</button>
      </div>
      </div>
    </div>
    {legal&&<LegalOverlay kind={legal} onClose={()=>setLegal(null)} />}
  </div>
}
