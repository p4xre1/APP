import { Shield } from 'lucide-react'
import { t } from '../i18n'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { normalizePin, createOrChangePin, unlockPin, unlockBiometric, lockVault, isUnlocked, subscribeLock, readMeta } from '../lib/vault'
import { PASSCODE_MIN, PASSCODE_MAX, PIN_MAX } from '../lib/secret'
import ResetFlow from './ResetFlow'
import { applyImportedPreferences } from '../lib/db'
import { usePreferences, useI18n, errorText } from '../i18n'
import { number } from '../lib/format'
import LanguagePicker from './LanguagePicker'
import { useFatorati } from '../store/useFatorati'

export default function SecurityGate({ children }: {children:ReactNode}) {
  const {t}=useI18n(),prefs=usePreferences(),unlocked=useSyncExternalStore(subscribeLock,isUnlocked)
  const [configured,setConfigured]=useState<boolean|null>(null),[biometric,setBiometric]=useState(false)
  const [pin,setPin]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [passcode,setPasscode]=useState(false)
  const [blocked,setBlocked]=useState(0),[clock,setClock]=useState(Date.now()),[ready,setReady]=useState(false)
  const refresh=async()=>{const meta=await readMeta();setConfigured(!!meta.salt);setBiometric(meta.biometric);setBlocked(meta.blockedUntil)}
  useEffect(()=>{void refresh().catch(e=>setError(errorText(e)))},[unlocked])
  useEffect(()=>{
    const clear=()=>{setPin('');setRepeat('');setReady(false);useFatorati.setState({business:null,customers:[],projects:[],invoices:[],estimates:[],expenses:[],products:[],settings:null,isLoading:true,isOnboarded:false})}
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
  // Unlocking must accept whatever the owner chose at setup, PIN or passcode.
  const digitsOnly=configured===false&&!passcode
  const clean=(value:string)=>digitsOnly?normalizePin(value).replace(/[^0-9]/g,''):value.replace(/[^A-Za-z0-9]/g,'')
  const secretLabel=configured===false?(passcode?t('Passcode'):t('6 to 12 digit PIN')):t('PIN or passcode')
  if(unlocked&&ready)return <>{children}</>
  return <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
    <div className="bg-surface rounded-xl border border-line p-5 max-w-md w-full shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h1 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2"><Shield className="w-5 h-5" />{t(configured?t("Unlock Fatorati"):t("Create your PIN"))}</h1>
      <div className="space-y-3.5">
      <LanguagePicker />
      {!configured&&<p className="text-[13px] text-warn">{t('PIN warning')}</p>}
      <form onSubmit={e=>{e.preventDefault();void submit()}} className="space-y-3.5">
        {configured===false&&<div className="flex gap-2">
          <button type="button" onClick={()=>{setPasscode(false);setPin('');setRepeat('')}} className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border ${passcode?'border-line text-muted bg-surface':'border-brand/30 text-brand bg-brand-50'}`}>{t('Numeric PIN')}</button>
          <button type="button" onClick={()=>{setPasscode(true);setPin('');setRepeat('')}} className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border ${!passcode?'border-line text-muted bg-surface':'border-brand/30 text-brand bg-brand-50'}`}>{t('Passcode')}</button>
        </div>}
        <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{secretLabel}</span><input autoFocus aria-label={secretLabel} type="password" inputMode={digitsOnly?'numeric':'text'} autoComplete="off" maxLength={digitsOnly?PIN_MAX:PASSCODE_MAX} required value={pin} onChange={e=>setPin(clean(e.target.value))} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
        {configured===false&&<p className="text-[12px] text-muted">{t('A PIN can be 6 to 12 digits. A passcode needs at least {min} letters or digits.', { min: PASSCODE_MIN })}</p>}
        {configured===false&&<label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{passcode?t('Confirm passcode'):t('Confirm PIN')}</span><input type="password" inputMode={digitsOnly?'numeric':'text'} autoComplete="off" maxLength={digitsOnly?PIN_MAX:PASSCODE_MAX} required value={repeat} onChange={e=>setRepeat(clean(e.target.value))} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>}
        <button disabled={busy||configured===null||blocked>clock} className="w-full bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t(busy?t("Working..."):configured?t("Unlock"):t("Create PIN"))}</button>
      </form>
      {biometric&&<button disabled={busy||blocked>clock} onClick={()=>void submit(true)} className="w-full bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium">{t('Use biometrics')}</button>}
      {blocked>clock&&<p role="status">{t('Wait seconds',{count:number(Math.ceil((blocked-clock)/1000))})}</p>}
      {error&&<p role="alert" className="text-serious text-[13px]">{t(error)}</p>}
      <ResetFlow mode="lock" />
      </div>
    </div>
  </div>
}
