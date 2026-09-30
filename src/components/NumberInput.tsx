import { useEffect, useState } from 'react'

/**
 * Numeric field that can be cleared. The displayed text is kept separate from the
 * committed number, so deleting the last digit shows an empty box instead of 0.
 */
export default function NumberInput({ value, onChange, className = '', ...rest }: {
  value: number
  onChange: (value: number) => void
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [text, setText] = useState(() => (value ? String(value) : ''))
  useEffect(() => {
    setText(current => (Number(current) === value ? current : value ? String(value) : ''))
  }, [value])
  return <input
    {...rest}
    type="number"
    inputMode="decimal"
    value={text}
    onChange={event => {
      const next = event.target.value
      setText(next)
      const parsed = Number(next)
      onChange(next.trim() === '' || !Number.isFinite(parsed) ? 0 : parsed)
    }}
    className={className}
  />
}
