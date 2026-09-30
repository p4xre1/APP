import { Settings } from 'lucide-react'
import { useState } from 'react'
import { useI18n, usePreferences, errorText } from '../i18n'
import { savePreferences, supportedValues, type DisplayPreferences } from '../lib/preferences'
import { weekDays } from '../lib/format'
import { useFatorati } from '../store/useFatorati'
import LanguagePicker from './LanguagePicker'
import CurrencyPicker from './CurrencyPicker'
const accents=['#2563eb','#7c3aed','#db2777','#dc2626','#ea580c','#ca8a04','#16a34a','#0d9488','#0891b2','#475569']
export default function PreferencesPanel(){
  const {t}=useI18n(),p=usePreferences(),[zoneSearch,setZoneSearch]=useState(''),[message,setMessage]=useState('')
  const save=async(patch:Partial<DisplayPreferences>)=>{try{await savePreferences(patch);setMessage('')}catch(e){setMessage(errorText(e))}}
  const select=(label:string,key:keyof DisplayPreferences,options:(string|number)[])=> <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t(label)}</span><select aria-label={t(label)} value={String(p[key])} onChange={e=>void save({[key]:typeof p[key]==='number'?Number(e.target.value):e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">{options.map(value=><option key={value} value={value}>{t(`${key}.${value}`)}</option>)}</select></label>
  return <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2"><Settings className="w-5 h-5" />{t('Language and appearance')}</h2>
    <div className="space-y-3.5">
    <LanguagePicker />
    <CurrencyPicker value={p.defaultCurrency} onChange={async currency=>{
      try{await useFatorati.getState().updateBusiness({currency});await useFatorati.getState().updateSettings({currency});await save({defaultCurrency:currency})}catch(e){setMessage(errorText(e))}
    }}/>
    {select('Number digits','digits',['latn','arab'])}
    {select('Date format','dateFormat',['auto','DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD'])}
    {select('Time format','timeFormat',['12h','24h'])}
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Search time zones')}</span><input value={zoneSearch} onChange={e=>setZoneSearch(e.target.value)} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Time zone')}</span><select aria-label={t('Time zone')} value={p.timeZone} onChange={e=>void save({timeZone:e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">{[...new Set([p.timeZone,'UTC',...supportedValues('timeZone')])].filter(zone=>zone===p.timeZone||zone.toLowerCase().includes(zoneSearch.toLowerCase())).map(zone=><option key={zone}>{zone}</option>)}</select></label>
    {select('First day of week','firstDay',[0,1,6])}
    <p className="text-[12px] text-muted">{weekDays().join(' · ')}</p>
    <label className="flex items-center gap-2 min-h-12 text-[13px] text-ink"><input type="checkbox" checked={p.hijri} onChange={e=>void save({hijri:e.target.checked})}/>{t('Hijri calendar for Arabic')}</label>
    {select('Theme','theme',['light','dark','system'])}
    <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Accent color')}</span><input type="color" value={p.accent} onChange={e=>void save({accent:e.target.value})} className="block w-16 h-10 border border-line-strong rounded-lg bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
    <div className="flex flex-wrap gap-2">{accents.map(color=><button key={color} aria-label={`${t('Accent color')} ${color}`} aria-pressed={color===p.accent} onClick={()=>void save({accent:color})} className="w-8 h-8 rounded-lg border border-line-strong transition-all active:scale-[0.98] disabled:opacity-40" style={{backgroundColor:color}} />)}</div>
    {select('Spacing','spacing',['comfortable','compact'])}
    <label className="flex items-center gap-2 min-h-12 text-[13px] text-ink"><input type="checkbox" checked={p.pdfColor} onChange={e=>void save({pdfColor:e.target.checked})}/>{t('Use color in PDFs')}</label>
    {message&&<p role="alert" className="text-[13px] text-muted">{t(message)}</p>}
    </div>
  </div>
}
