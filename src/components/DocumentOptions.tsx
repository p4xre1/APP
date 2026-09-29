import type { Language } from '../lib/preferences'
import { getPreferences } from '../lib/preferences'
import { useI18n } from '../i18n'
import CurrencyPicker from './CurrencyPicker'
import LanguagePicker from './LanguagePicker'
export interface DocumentPreferences { currency?:string;language?:Language;exchangeRate?:number;rateCurrency?:string;pdfColor?:boolean }
export default function DocumentOptions({value,onChange}:{value:DocumentPreferences;onChange:(patch:DocumentPreferences)=>void}){
  const {t}=useI18n(),prefs=getPreferences()
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
    <CurrencyPicker value={value.currency||prefs.defaultCurrency} onChange={currency=>onChange({currency,exchangeRate:undefined,rateCurrency:undefined})}/>
    <LanguagePicker value={value.language||prefs.language} onChange={language=>onChange({language})}/>
    {(value.currency||prefs.defaultCurrency)!==prefs.defaultCurrency&&<label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Manual exchange rate',{currency:prefs.defaultCurrency})}</span><input type="number" min="0" step="any" value={value.exchangeRate??''} onChange={e=>onChange({exchangeRate:e.target.value?Number(e.target.value):undefined,rateCurrency:prefs.defaultCurrency})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>}
    <label className="flex gap-2 items-center"><input type="checkbox" checked={value.pdfColor??prefs.pdfColor} onChange={e=>onChange({pdfColor:e.target.checked})}/>{t('Use color in PDFs')}</label>
  </div>
}
