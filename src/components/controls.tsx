import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'

interface SectionProps {
  title: string
  note?: string
  action?: ReactNode
  children: ReactNode
}

export const Section = ({ title, note, action, children }: SectionProps): ReactNode => (
  <section className="section">
    <header className="section-head">
      <div>
        <h3>{title}</h3>
        {note ? <p>{note}</p> : null}
      </div>
      {action}
    </header>
    <div className="section-body">{children}</div>
  </section>
)

interface RangeFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (value: number) => string
  onChange: (value: number) => void
  disabled?: boolean
  action?: ReactNode
}

export const RangeField = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  format,
  onChange,
  disabled,
  action,
}: RangeFieldProps): ReactNode => {
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className={clsx('range-field', disabled && 'is-disabled')}>
      <div className="range-head">
        <span>{label}</span>
        <div className="range-meta">
          <span className="range-value">{format ? format(value) : value.toFixed(2)}</span>
          {action}
        </div>
      </div>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        style={{ '--range-fill': `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
  disabled?: boolean
}

export const NumberField = ({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  disabled,
}: NumberFieldProps): ReactNode => {
  const handle = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value)
    if (!Number.isFinite(next)) return
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next)))
  }
  return (
    <label className={clsx('number-field', disabled && 'is-disabled')}>
      <span>{label}</span>
      <span className="number-input-wrap">
        <input
          type="number"
          value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={handle}
        />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </label>
  )
}

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  note?: string
  disabled?: boolean
}

export const Toggle = ({ label, checked, onChange, note, disabled }: ToggleProps): ReactNode => (
  <div className={clsx('toggle-row', disabled && 'is-disabled')}>
    <div>
      <span className="toggle-label">{label}</span>
      {note ? <span className="toggle-note">{note}</span> : null}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={clsx('switch', checked && 'is-on')}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  </div>
)

interface SegmentedProps<T extends string> {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export const Segmented = <T extends string,>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>): ReactNode => (
  <div className="segmented-wrap">
    {label ? <span className="field-label">{label}</span> : null}
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={clsx(option.value === value && 'is-active')}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
)

interface ColorFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export const ColorField = ({ label, value, onChange }: ColorFieldProps): ReactNode => (
  <label className="color-field">
    <span>{label}</span>
    <span className="color-input-wrap">
      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
      <code>{value.toUpperCase()}</code>
    </span>
  </label>
)

interface SelectFieldProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}

export const SelectField = ({
  label,
  value,
  options,
  onChange,
  disabled,
}: SelectFieldProps): ReactNode => (
  <label className="select-field">
    <span>{label}</span>
    <span className="select-wrap">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  </label>
)
