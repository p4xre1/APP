import { showAlert } from '../lib/dialogs'
import { errorText } from '../i18n'
import { t } from '../i18n'
import LanguagePicker from './LanguagePicker'
import ExportProtect from './ExportProtect'
import { getPreferences } from '../lib/preferences'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportCsv } from '../lib/csv'
import { EXPORT_CANCELED } from '../lib/export-warning'
import type { CsvStore } from '../lib/csv'

export default function ExportCsvButton({ store }: { store: CsvStore }) {
  const [language,setLanguage]=useState(getPreferences().language)
  const [protect,setProtect]=useState({enabled:false,password:''})
  const [busy, setBusy] = useState(false)
  return <div className="flex flex-wrap items-end gap-4"><LanguagePicker value={language} onChange={setLanguage} />
  <ExportProtect value={protect} onChange={patch=>setProtect(current=>({...current,...patch}))}/>
  <button disabled={busy} onClick={async () => {
    setBusy(true)
    try { await exportCsv(store,language,protect.enabled?protect.password:undefined) }
    catch (error) { if ((error as Error)?.message !== EXPORT_CANCELED) showAlert(t("CSV export not completed: ") + (errorText(error))) }
    finally { setBusy(false) }
  }} className="bg-brand hover:bg-brand-700 text-white disabled:opacity-50 px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
    <Download className="w-4 h-4" />{busy ? t("Exporting...") : t("Export CSV")}
  </button></div>
}
