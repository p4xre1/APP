import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LayoutDashboard, Users, FolderOpen, FileText, ClipboardList, ReceiptText, Package, CalendarDays, BarChart3, Settings, Search, PanelLeftClose, PanelLeftOpen, Menu, X, Plus, ChevronDown, ShieldCheck, LockKeyhole, Sun, Moon, type LucideIcon } from 'lucide-react'
import { useI18n, usePreferences, errorText } from '../i18n'
import { savePreferences } from '../lib/preferences'
import { lockVault } from '../lib/vault'
import { showAlert } from '../lib/dialogs'
import type { ModuleKey } from '../store/types'

const navigation: {key:ModuleKey; label:string; group:string; icon:LucideIcon}[] = [
  {key:'dashboard',label:'Dashboard',group:'Overview',icon:LayoutDashboard},
  {key:'customers',label:'Customers',group:'Business',icon:Users},
  {key:'projects',label:'Projects',group:'Business',icon:FolderOpen},
  {key:'invoices',label:'Invoices',group:'Finance',icon:FileText},
  {key:'estimates',label:'Estimates',group:'Finance',icon:ClipboardList},
  {key:'expenses',label:'Expenses',group:'Finance',icon:ReceiptText},
  {key:'products',label:'Products',group:'Business',icon:Package},
  {key:'calendar',label:'Calendar',group:'Finance',icon:CalendarDays},
  {key:'reports',label:'Reports',group:'Finance',icon:BarChart3},
  {key:'settings',label:'Settings',group:'Workspace',icon:Settings},
]
export default function AppShell({active,onNavigate,businessName,children}:{active:ModuleKey;onNavigate:(key:ModuleKey)=>void;businessName:string;children:ReactNode}) {
  const {t}=useI18n(),prefs=usePreferences()
  const [collapsed,setCollapsed]=useState(false),[search,setSearch]=useState(''),[quick,setQuick]=useState(false),[profile,setProfile]=useState(false)
  const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches)
  const drawer=useRef<HTMLDialogElement>(null),quickRef=useRef<HTMLDivElement>(null),profileRef=useRef<HTMLDivElement>(null)
  const dark=prefs.theme==='dark'||(prefs.theme==='system'&&systemDark)
  useEffect(()=>{
    const media=matchMedia('(prefers-color-scheme: dark)'),change=()=>setSystemDark(media.matches)
    const wide=matchMedia('(min-width: 1024px)'),resize=()=>{if(wide.matches)drawer.current?.close()}
    const close=(event:MouseEvent)=>{if(!quickRef.current?.contains(event.target as Node))setQuick(false);if(!profileRef.current?.contains(event.target as Node))setProfile(false)}
    wide.addEventListener('change',resize);media.addEventListener('change',change);document.addEventListener('click',close)
    return()=>{wide.removeEventListener('change',resize);media.removeEventListener('change',change);document.removeEventListener('click',close)}
  },[])
  const navigate=(key:ModuleKey)=>{onNavigate(key);drawer.current?.close();setQuick(false);setProfile(false)}
  const sidebar=(mobile=false)=>{
    const small=collapsed&&!mobile
    const filtered=navigation.filter(item=>t(item.label).toLocaleLowerCase(prefs.language).includes(search.toLocaleLowerCase(prefs.language)))
    return <>
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        {small ? <span className="mx-auto grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-[16px] font-extrabold">{t('Fatorati').charAt(0)}</span> : <span className="inline-flex items-center gap-2.5 select-none"><span className="grid h-8 w-8 place-items-center rounded-[9px] bg-brand shadow-sm"><ReceiptText className="h-[18px] w-[18px]" strokeWidth={2.4}/></span><span className="text-[18px] font-extrabold tracking-tight leading-none text-white">{t('Fatorati')}</span></span>}
        <button aria-label={t(mobile?'Close navigation':small?'Expand sidebar':'Collapse sidebar')} onClick={()=>mobile?drawer.current?.close():setCollapsed(!collapsed)} className="rounded-lg p-1.5 text-sidebar-faint hover:bg-sidebar-hover hover:text-white">
          {mobile?<X className="h-4 w-4"/>:small?<PanelLeftOpen className="h-4 w-4 directional"/>:<PanelLeftClose className="h-4 w-4 directional"/>}
        </button>
      </div>
      {!small&&<div className="px-3 pb-2"><div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-faint"/><input aria-label={t('Search modules')} value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('Search modules')} className="w-full rounded-lg bg-sidebar-hover py-2 ps-9 pe-3 text-[12.5px] text-white outline-none placeholder:text-sidebar-faint focus:ring-1 focus:ring-brand"/></div></div>}
      <nav aria-label={t('Navigation')} className="flex-1 overflow-y-auto px-3 pb-4">
        {['Overview','Business','Finance','Workspace'].map(group=>{
          const items=filtered.filter(item=>item.group===group)
          return items.length>0&&<div key={group} className="mt-4 first:mt-1">
            {!small&&<p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-faint">{t(group)}</p>}
            <div className="space-y-0.5">{items.map(item=><button key={item.key} aria-label={t(item.label)} aria-current={active===item.key?'page':undefined} title={small?t(item.label):undefined} onClick={()=>navigate(item.key)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${active===item.key?'bg-sidebar-active shadow-sm':'text-sidebar-ink hover:bg-sidebar-hover hover:text-white'} ${small?'justify-center':''}`}><item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active===item.key?2.4:2}/>{!small&&<span className="truncate">{t(item.label)}</span>}</button>)}</div>
          </div>
        })}
      </nav>
      {!small&&<div className="border-t border-sidebar-hover px-4 py-3 text-[10.5px] text-sidebar-faint"><p className="truncate">{businessName}</p><p>{t('100% Local • Offline')}</p></div>}
    </>
  }
  return <div className="flex min-h-screen bg-canvas">
    <aside className={`dark-scroll sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-ink transition-all duration-200 lg:flex ${collapsed?'w-[68px]':'w-64'}`}>{sidebar()}</aside>
    <dialog ref={drawer} aria-label={t('Navigation')} onClick={e=>{if(e.target===drawer.current)drawer.current.close()}} className="fixed inset-y-0 start-0 end-auto m-0 h-dvh max-h-none w-64 max-w-none border-0 bg-sidebar p-0 text-sidebar-ink backdrop:bg-navy/50 lg:hidden"><div className="dark-scroll flex h-full flex-col">{sidebar(true)}</div></dialog>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 no-print">
        <div className="flex min-w-0 items-center gap-3"><button aria-label={t('Open navigation')} onClick={()=>drawer.current?.showModal()} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5 lg:hidden"><Menu className="h-5 w-5"/></button><h1 className="truncate text-[16px] font-bold tracking-tight text-ink">{t(navigation.find(item=>item.key===active)!.label)}</h1></div>
        <div className="flex items-center gap-2.5">
          <button aria-label={t(dark?'theme.light':'theme.dark')} onClick={()=>void savePreferences({theme:dark?'light':'dark'}).catch(e=>showAlert(errorText(e)))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-ink/5">{dark?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>}</button>
          <div ref={quickRef} className="relative" onKeyDown={e=>{if(e.key==='Escape')setQuick(false)}}><button aria-label={t('Quick actions')} aria-expanded={quick} onClick={()=>setQuick(!quick)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold shadow-sm hover:bg-brand-700"><Plus className="h-4 w-4"/><span className="hidden sm:inline">{t('Quick actions')}</span><ChevronDown className="h-3.5 w-3.5"/></button>{quick&&<div className="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">{(['projects','invoices','expenses'] as const).map(key=>{const item=navigation.find(item=>item.key===key)!;return <button key={key} onClick={()=>navigate(key)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium hover:bg-ink/5"><item.icon className="h-4 w-4 text-brand"/>{t(item.label)}</button>})}</div>}</div>
          <div ref={profileRef} className="relative" onKeyDown={e=>{if(e.key==='Escape')setProfile(false)}}><button aria-label={t('Workspace')} aria-expanded={profile} onClick={()=>setProfile(!profile)} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pe-2 ps-1 hover:border-muted"><span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{businessName.charAt(0).toUpperCase()}</span><ChevronDown className="h-3.5 w-3.5 text-muted"/></button>{profile&&<div className="absolute end-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-xl"><p className="truncate border-b border-line px-4 py-3 text-[13px] font-semibold">{businessName}</p><button onClick={()=>navigate('settings')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] hover:bg-ink/5"><ShieldCheck className="h-4 w-4 text-muted"/>{t('Settings')}</button><button onClick={lockVault} className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-start text-[13px] text-serious hover:bg-serious-50"><LockKeyhole className="h-4 w-4"/>{t('Lock now')}</button></div>}</div>
        </div>
      </header>
      <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
    </div>
  </div>
}
