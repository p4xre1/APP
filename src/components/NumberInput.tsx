import { useEffect, useId, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { getPreferences } from '../lib/preferences'
import { formatNumberText, numberInputChange, parseNumberText, type DigitStyle, type NumberRules } from '../lib/number-input'

export interface NumberInputProps {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  /** Unit shown inside the field, e.g. MAD. */
  suffix?: string
  min?: number
  required?: boolean
  /** Translation key (or text) shown under the field when saving fails validation. */
  error?: string | null
  /** Small explanation under the field, e.g. "Quantity" or "Unit price (MAD)". */
  hint?: string
  /** Integer-only field (Stock): decimal separators are rejected. */
  integer?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const numberInputClass = 'w-full min-h-12 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[16px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-50'

/**
 * Money / quantity field. Keeps raw text (so it can be emptied), accepts "." and ",",
 * blocks letters, selects everything on focus and formats on blur. Empty stays empty.
 */
export default function NumberInput({
  label, value, onChange, suffix, min, required, error, hint, integer = false,
  placeholder, disabled, className = '',
}: NumberInputProps) {
  const { t } = useI18n()
  const id = `number-${useId()}`
  const prefs = getPreferences()
  const [text, setText] = useState(() => formatNumberText(value, { integer, digits: prefs.digits, locale: prefs.language }))
  const focused = useRef(false)
  const emitted = useRef<number | null>(value)

  // External updates (form reset, another record) refresh the text unless the user is typing.
  useEffect(() => {
    if (!focused.current) { setText(formatNumberText(value, { integer, digits: prefs.digits, locale: prefs.language })); emitted.current = value }
  }, [value, integer, prefs.digits, prefs.language])

  return <div className={className}>
    <label htmlFor={id} className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">
      {label}{required ? ' *' : ''}
    </label>
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        enterKeyHint="next"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        value={text}
        placeholder={placeholder}
        onFocus={event => { focused.current = true; event.currentTarget.select() }}
        onBlur={() => {
          focused.current = false
          const parsed = parseNumberText(text)
          setText(formatNumberText(parsed, { integer, digits: prefs.digits, locale: prefs.language }))
          if (parsed !== emitted.current) { emitted.current = parsed; onChange(parsed) }
        }}
        onChange={event => {
          const next = numberInputChange(text, event.target.value, integer)
          setText(next.text)
          if (next.value !== emitted.current) { emitted.current = next.value; onChange(next.value) }
        }}
        className={`${numberInputClass} ${suffix ? 'pe-14' : ''}`}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[12px] font-semibold text-faint">{suffix}</span>}
    </div>
    {error
      ? <p id={`${id}-help`} role="alert" className="mt-1 text-[12px] text-serious">{t(error, { min: min ?? 0 })}</p>
      : hint ? <p id={`${id}-help`} className="mt-1 text-[12px] text-muted">{hint}</p> : null}
  </div>
}

export type { DigitStyle }
