import { Lock } from 'lucide-react'
import { useI18n } from '../i18n'

/** Optional password protection, shared by the CSV and PDF export controls. */
export default function ExportProtect({ value, onChange, label }: { value: { enabled: boolean; password: string }; onChange: (patch: { enabled?: boolean; password?: string }) => void; label?: string }) {
  const { t } = useI18n()
  const field = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
  return <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 text-[13px] text-ink">
      <input type="checkbox" checked={value.enabled} onChange={e => onChange({ enabled: e.target.checked, password: e.target.checked ? value.password : '' })} />
      <Lock className="w-4 h-4" />{label || t('Protect with password')}
    </label>
    {value.enabled && <label className="block">
      <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Export password')}</span>
      <input type="password" autoComplete="new-password" value={value.password} onChange={e => onChange({ password: e.target.value })} className={field} />
    </label>}
  </div>
}
