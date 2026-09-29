import { useMemo, useState } from 'react'
import { supportedValues } from '../lib/preferences'
import { useI18n } from '../i18n'
export default function CurrencyPicker({value,onChange}:{value:string;onChange:(code:string)=>void}) {
  const {language,t}=useI18n(),[search,setSearch]=useState('')
  const names=useMemo(()=>new Intl.DisplayNames([language],{type:'currency'}),[language])
  const codes=useMemo(()=>supportedValues('currency'),[])
  const filtered=codes.filter(code=>code===value||`${code} ${names.of(code)}`.toLocaleLowerCase(language).includes(search.toLocaleLowerCase(language)))
  return <div className="space-y-3.5">
    <label className="block">
      <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Search currencies')}</span>
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
    </label>
    <label className="block">
      <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Currency')}</span>
      <select aria-label={t('Currency')} value={value} onChange={e=>onChange(e.target.value)} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">{filtered.map(code=><option key={code} value={code}>{code} — {names.of(code)}</option>)}</select>
    </label>
  </div>
}
