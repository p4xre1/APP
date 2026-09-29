import { showAlert } from '../lib/dialogs'
import { useI18n, errorText } from '../i18n'
import { languages, savePreferences, type Language } from '../lib/preferences'
export default function LanguagePicker({value,onChange}:{value?:Language;onChange?:(language:Language)=>void}) {
  const {language,t}=useI18n()
  return <label className="block">
    <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Language')}</span>
    <select aria-label={t('Language')} value={value||language} onChange={e=>{
      const next=e.target.value as Language
      if(onChange)onChange(next);else void savePreferences({language:next}).catch(e=>showAlert(errorText(e)))
    }} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">{languages.map(code=><option key={code} value={code}>{t(`language.${code}`)}</option>)}</select>
  </label>
}
