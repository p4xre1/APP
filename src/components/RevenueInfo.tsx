import { HelpCircle } from 'lucide-react'
import { t, useI18n } from '../i18n'
import { showAlert } from '../lib/dialogs'

/**
 * "?" next to a revenue title: what counts as revenue, what counts as pending,
 * and that drafts are never counted.
 */
export default function RevenueInfo({ className = '' }: { className?: string }) {
  const { t: translate } = useI18n()
  const explain = () => {
    const lines = [
      `${translate('What counts as revenue')}: ${translate('Revenue counts only invoices with the Paid status.')}`,
      `${translate('What counts as pending')}: ${translate('Pending counts invoices with the Sent or Overdue status. Overdue invoices are past their due date.')}`,
      `${translate('Drafts are not counted')}: ${translate('Draft invoices are excluded from revenue and from pending until they are sent or paid.')}`,
      translate('Totals are shown per currency. Amounts in different currencies are never added together.'),
    ]
    void showAlert(lines.join('\n\n'))
  }
  return <button
    type="button"
    onClick={explain}
    aria-label={t('How revenue is calculated')}
    title={t('How revenue is calculated')}
    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-strong text-muted transition-colors hover:border-brand hover:text-brand ${className}`}
  >
    <HelpCircle className="h-3.5 w-3.5" />
  </button>
}
