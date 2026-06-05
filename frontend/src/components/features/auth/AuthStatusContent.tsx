'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

type AuthStatusTone = 'info' | 'success' | 'error' | 'loading'
type AuthStatusActionVariant = 'primary' | 'secondary' | 'cyan'

interface AuthStatusAction {
  label: string
  href?: string
  onClick?: () => void
  icon?: LucideIcon
  variant?: AuthStatusActionVariant
}

interface AuthStatusContentProps {
  title: string
  message: string
  icon: LucideIcon
  tone?: AuthStatusTone
  meta?: string
  actions?: AuthStatusAction[]
}

const statusIconClasses: Record<AuthStatusTone, string> = {
  info: styles.statusIconInfo,
  success: styles.statusIconSuccess,
  error: styles.statusIconError,
  loading: styles.statusIconLoading,
}

const actionClasses: Record<AuthStatusActionVariant, string> = {
  primary: cn(styles.submitBtn, styles.submitBtnPrimary),
  cyan: cn(styles.submitBtn, styles.submitBtnCyan),
  secondary: cn(styles.secondaryLink, styles.secondaryButton),
}

export function AuthStatusContent({
  title,
  message,
  icon: Icon,
  tone = 'info',
  meta,
  actions = [],
}: AuthStatusContentProps) {
  return (
    <div className={styles.formBoxWide}>
      <div className={styles.statusPanel}>
        <div className={cn(styles.statusIcon, statusIconClasses[tone])}>
          {tone === 'loading' ? (
            <Loader2 className={styles.statusSpinnerIcon} />
          ) : (
            <Icon className={styles.statusIconGlyph} />
          )}
        </div>

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{message}</p>

        {meta ? <p className={styles.statusMeta}>{meta}</p> : null}

        {actions.length > 0 ? (
          <div className={styles.statusActions}>
            {actions.map((action) => {
              const ActionIcon = action.icon
              const className = actionClasses[action.variant ?? 'secondary']
              const content = (
                <>
                  <span>{action.label}</span>
                  {ActionIcon ? <ActionIcon className="h-5 w-5" /> : null}
                </>
              )

              if (action.href) {
                return (
                  <Link
                    key={`${action.label}-${action.href}`}
                    href={action.href}
                    className={className}
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={`${action.label}-button`}
                  type="button"
                  onClick={action.onClick}
                  className={className}
                >
                  {content}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
