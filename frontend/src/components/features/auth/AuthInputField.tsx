'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AuthInputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  icon: LucideIcon
}

export function AuthInputField({
  label,
  value,
  onChange,
  error,
  icon: Icon,
  type = 'text',
  className,
  ...props
}: AuthInputFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && revealed ? 'text' : type

  return (
    <div className="space-y-2">
      <label className="block font-ui text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </label>

      <div className="relative">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500">
          <Icon className="h-5 w-5" />
        </div>

        <input
          {...props}
          type={resolvedType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-2xl border px-12 py-3.5 font-ui text-sm text-stone-900 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-200',
            'bg-white/75 dark:bg-stone-950/55 backdrop-blur-md',
            'border-white/70 dark:border-stone-700/80',
            'placeholder:text-stone-400 dark:placeholder:text-stone-500',
            'focus:border-aurora-purple/60 focus:outline-none focus:ring-4 focus:ring-aurora-purple/12',
            'dark:text-stone-100 dark:focus:border-aurora-purple/50 dark:focus:ring-aurora-purple/18',
            error && 'border-red-300 pr-11 focus:border-red-400 focus:ring-red-500/10 dark:border-red-500/40 dark:focus:border-red-500/50',
            isPassword && 'pr-12',
            className
          )}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            aria-label={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="font-ui text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  )
}
