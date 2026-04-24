'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

interface AuthExperienceFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  value: string
  onChange: (value: string) => void
  icon: LucideIcon
  error?: string
  helperText?: string
  optionalLabel?: string
  required?: boolean
  warning?: boolean
}

export function AuthExperienceField({
  label,
  value,
  onChange,
  icon: Icon,
  error,
  helperText,
  optionalLabel,
  required = false,
  warning = false,
  type = 'text',
  ...props
}: AuthExperienceFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && revealed ? 'text' : type

  return (
    <div className={styles.formGroup}>
      <label className={styles.fieldLabel}>
        <span>{label}</span>
        <span className={styles.labelMeta}>
          {optionalLabel ? <span className={styles.optionalLabel}>{optionalLabel}</span> : null}
          {required ? <span className={styles.requiredMark}>*</span> : null}
        </span>
      </label>

      <div className={cn(styles.inputWrapper, warning && styles.inputWrapperWarning)}>
        <div className={styles.inputBox}>
          <Icon className={styles.inputIcon} />
          <input
            {...props}
            type={resolvedType}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={Boolean(error)}
            className={styles.inputField}
          />

          {isPassword ? (
            <span className={styles.inputAction}>
              <button
                type="button"
                className={styles.inputToggle}
                onClick={() => setRevealed((prev) => !prev)}
                aria-label={revealed ? 'Hide password' : 'Show password'}
              >
                {revealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </span>
          ) : null}
        </div>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {helperText ? <p className={cn(styles.helperText, styles.fieldHelperText)}>{helperText}</p> : null}
    </div>
  )
}
