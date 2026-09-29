import type { Language } from '../lib/preferences'
import { getPreferences } from '../lib/preferences'
import { useI18n } from '../i18n'
import CurrencyPicker from './CurrencyPicker'
import LanguagePicker from './LanguagePicker'
import NumberInput from './NumberInput'
export interface DocumentPreferences { currency?:string;language?:Language;exchangeRate?:number;rateCurrency?:string;pdfColor?:boolean }
export default function DocumentOptions({value,onChange}:{value:DocumentPreferences;onChange:(patch:DocumentPreferences)=>void}){
  const {t}=useI18n(),prefs=getPreferences()
  const documentCurrency=value.currency||prefs.defaultCurrency
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
    <CurrencyPicker value={documentCurrency} onChange={currency=>onChange({currency,exchangeRate:undefined,rateCurrency:undefined})}/>
    <LanguagePicker value={value.language||prefs.language} onChange={language=>onChange({language})}/>
    {documentCurrency!==prefs.defaultCurrency&&<NumberInput
      label={t('Manual exchange rate',{currency:prefs.defaultCurrency})}
      value={value.exchangeRate??null}
      min={0}
      suffix={prefs.defaultCurrency}
      hint={t('How many {currency} one unit of {documentCurrency} is worth',{currency:prefs.defaultCurrency,documentCurrency})}
      onChange={rate=>onChange({exchangeRate:rate===null?undefined:rate,rateCurrency:prefs.defaultCurrency})}
    />}
    <label className="flex gap-2 items-center min-h-12"><input type="checkbox" className="h-5 w-5" checked={value.pdfColor??prefs.pdfColor} onChange={e=>onChange({pdfColor:e.target.checked})}/>{t('Use color in PDFs')}</label>
  </div>
}
