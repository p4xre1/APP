import { useId } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

/** Shared phone-friendly field styles: 16px text, 48px minimum height, visible label above. */
export const fieldInputClass = 'w-full min-h-12 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[16px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-50'
export const fieldLabelClass = 'block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]'
export const fieldHintClass = 'mt-1 text-[12px] text-muted'
export const fieldErrorClass = 'mt-1 text-[12px] text-serious'

export function Field({ label, hint, error, required, htmlFor, children, className = '' }: {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  const { t } = useI18n()
  return <div className={className}>
    <label htmlFor={htmlFor} className={fieldLabelClass}>{label}{required ? ' *' : ''}</label>
    {children}
    {error
      ? <p role="alert" className={fieldErrorClass}>{t(error)}</p>
      : hint ? <p className={fieldHintClass}>{hint}</p> : null}
  </div>
}

export interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string | null
  required?: boolean
  type?: 'text' | 'email' | 'tel' | 'password' | 'search' | 'url'
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'url'
  autoComplete?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Single-line text input that always carries a visible label above it. */
export function TextField({
  label, value, onChange, hint, error, required, type = 'text', inputMode, autoComplete,
  placeholder, disabled, className = '',
}: TextFieldProps) {
  const id = `field-${useId()}`
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      value={value}
      placeholder={placeholder}
      onChange={event => onChange(event.target.value)}
      className={fieldInputClass}
    />
  </Field>
}
