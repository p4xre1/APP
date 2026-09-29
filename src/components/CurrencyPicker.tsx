import { useMemo, useState } from 'react'
import { currencyCodes } from '../lib/preferences'
import { useI18n } from '../i18n'
export default function CurrencyPicker({value,onChange}:{value:string;onChange:(code:string)=>void}) {
  const {language,t}=useI18n(),[search,setSearch]=useState('')
  const names=useMemo(()=>new Intl.DisplayNames([language],{type:'currency'}),[language])
  const codes=useMemo(()=>currencyCodes(),[])
  // Every required currency (MAD, EUR, USD, GBP, AED, SAR, DZD, TND, XOF, CAD) is listed,
  // and the selected one stays visible while searching.
  const name=(code:string)=>{try{return names.of(code)||code}catch{return code}}
  const filtered=codes.filter(code=>code===value||`${code} ${name(code)}`.toLocaleLowerCase(language).includes(search.toLocaleLowerCase(language)))
  const preview=useMemo(()=>{try{return new Intl.NumberFormat(`${language}-u-nu-latn`,{style:'currency',currency:value}).format(1234.5)}catch{return value}},[language,value])
  return <div className="space-y-3.5">
    <label className="block">
      <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Search currencies')}</span>
      <input type="search" inputMode="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('Type a code or name')} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
    </label>
    <label className="block">
      <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Currency')}</span>
      <select aria-label={t('Currency')} value={value} onChange={e=>onChange(e.target.value)} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">{filtered.map(code=><option key={code} value={code}>{code} — {name(code)}</option>)}</select>
      <span className="mt-1 block text-[12px] text-muted">{t('Formatting example')}: {preview}</span>
    </label>
  </div>
}
